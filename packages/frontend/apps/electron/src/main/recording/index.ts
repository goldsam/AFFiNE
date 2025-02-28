import path from 'node:path';

import { ShareableContent } from '@affine/native';
import { app, nativeImage, Notification } from 'electron';
import fs from 'fs-extra';
import { debounce } from 'lodash-es';
import { BehaviorSubject, distinctUntilChanged, groupBy, mergeMap } from 'rxjs';

import { isMacOS } from '../../shared/utils';
import { beforeAppQuit } from '../cleanup';
import { ensureHelperProcess } from '../helper-process';
import { logger } from '../logger';
import type { NamespaceHandlers } from '../type';
import { getMainWindow } from '../windows-manager';
import type {
  AppGroupInfo,
  Recording,
  RecordingStatus,
  TappableAppInfo,
} from './types';

const subscribers: Subscriber[] = [];

const SAVED_RECORDINGS_DIR = path.join(
  app.getPath('sessionData'),
  'recordings'
);

beforeAppQuit(() => {
  subscribers.forEach(subscriber => {
    subscriber.unsubscribe();
  });
});

let shareableContent: ShareableContent | null = null;

export const applications$ = new BehaviorSubject<TappableAppInfo[]>([]);
export const appGroups$ = new BehaviorSubject<AppGroupInfo[]>([]);

// recording id -> recording
// recordings will be saved in memory before consumed and created as an audio block to user's doc
const recordings = new Map<number, Recording>();

// there should be only one active recording at a time
export const recordingStatus$ = new BehaviorSubject<RecordingStatus | null>(
  null
);

function createAppGroup(processGroupId: number): AppGroupInfo | undefined {
  const groupProcess =
    shareableContent?.applicationWithProcessId(processGroupId);
  if (!groupProcess) {
    return;
  }
  return {
    processGroupId: processGroupId,
    apps: [], // leave it empty for now.
    name: groupProcess.name,
    bundleIdentifier: groupProcess.bundleIdentifier,
    // icon should be lazy loaded
    get icon() {
      try {
        return groupProcess.icon;
      } catch (error) {
        logger.error(`Failed to get icon for ${groupProcess.name}`, error);
        return undefined;
      }
    },
    isRunning: false,
  };
}

// pipe applications$ to appGroups$
function setupAppGroups() {
  subscribers.push(
    applications$.pipe(distinctUntilChanged()).subscribe(apps => {
      const appGroups: AppGroupInfo[] = [];
      apps.forEach(app => {
        let appGroup = appGroups.find(
          group => group.processGroupId === app.processGroupId
        );

        if (!appGroup) {
          appGroup = createAppGroup(app.processGroupId);
          if (appGroup) {
            appGroups.push(appGroup);
          }
        }
        if (appGroup) {
          appGroup.apps.push(app);
        }
      });

      appGroups.forEach(appGroup => {
        appGroup.isRunning = appGroup.apps.some(app => app.isRunning);
      });

      appGroups$.next(appGroups);
    })
  );
}

function setupNewRunningAppGroup() {
  const appGroupRunningChanged$ = appGroups$.pipe(
    mergeMap(groups => groups),
    groupBy(group => group.processGroupId),
    mergeMap(groupStream$ =>
      groupStream$.pipe(
        distinctUntilChanged((prev, curr) => prev.isRunning === curr.isRunning)
      )
    )
  );
  subscribers.push(
    appGroupRunningChanged$.subscribe(currentGroup => {
      if (currentGroup.isRunning) {
        // TODO(@pengx17): stub impl. will be replaced with a real one later
        const notification = new Notification({
          icon: currentGroup.icon
            ? nativeImage.createFromBuffer(currentGroup.icon)
            : undefined,
          title: 'Recording Meeting',
          body: `Recording meeting with ${currentGroup.name}`,
          actions: [
            {
              type: 'button',
              text: 'Start',
            },
          ],
        });
        notification.on('action', () => {
          startRecording(currentGroup);
        });
        notification.show();
      } else {
        // if the group is not running, we should stop the recording (if it is recording)
        if (
          recordingStatus$.value?.status === 'recording' &&
          recordingStatus$.value?.appGroup?.processGroupId ===
            currentGroup.processGroupId
        ) {
          stopRecording();
        }
      }
    })
  );
}

function createRecording(status: RecordingStatus) {
  const buffers: Float32Array[] = [];

  function tapAudioSamples(err: Error | null, samples: Float32Array) {
    const recordingStatus = recordingStatus$.getValue();
    if (
      !recordingStatus ||
      recordingStatus.id !== status.id ||
      recordingStatus.status === 'paused'
    ) {
      return;
    }

    if (err) {
      logger.error('failed to get audio samples', err);
    } else {
      buffers.push(new Float32Array(samples));
    }
  }

  const stream = status.app
    ? status.app.rawInstance.tapAudio(tapAudioSamples)
    : ShareableContent.tapGlobalAudio(null, tapAudioSamples);

  const recording: Recording = {
    id: status.id,
    startTime: status.startTime,
    app: status.app,
    appGroup: status.appGroup,
    buffers,
    stream,
  };

  return recording;
}

function concatBuffers(buffers: Float32Array[]): Float32Array {
  const totalSamples = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const buffer = new Float32Array(totalSamples);
  let offset = 0;
  buffers.forEach(buf => {
    buffer.set(buf, offset);
    offset += buf.length;
  });
  return buffer;
}

export async function saveRecording(id: number) {
  const recording = recordings.get(id);
  if (!recording) {
    logger.error(`Recording ${id} not found`);
    return;
  }
  const { startTime, appGroup, buffers } = recording;
  const directory = path.join(
    SAVED_RECORDINGS_DIR,
    `${appGroup?.name ?? 'systemaudio'}-${startTime}`
  );
  const helperProcessManager = await ensureHelperProcess();
  const buffer = concatBuffers(buffers);
  const mp3Buffer = await helperProcessManager.rpc?.encodeToMp3(buffer, {
    channels: recording.stream.channels,
    sampleRate: recording.stream.sampleRate,
  });

  if (!mp3Buffer) {
    logger.error('failed to encode audio samples to mp3');
    return;
  }

  await fs.ensureDir(directory);

  await fs.writeFile(path.join(directory, `recording.mp3`), mp3Buffer);
  await fs.writeJSON(path.join(directory, `recording.json`), {
    startTime,
    name: appGroup?.name ?? 'system audio',
    bundleIdentifier: appGroup?.bundleIdentifier,
  });
  if (appGroup?.icon) {
    await fs.writeFile(path.join(directory, `app.png`), appGroup.icon);
  }
  recordings.delete(recording.id);
  return mp3Buffer;
}

function setupRecordingListeners() {
  subscribers.push(
    recordingStatus$.pipe(distinctUntilChanged()).subscribe(status => {
      if (status?.status === 'recording') {
        let recording = recordings.get(status.id);
        // create a recording if not exists
        if (!recording) {
          recording = createRecording(status);
          recordings.set(status.id, recording);
        }
      } else if (status?.status === 'stopped') {
        const recording = recordings.get(status.id);
        if (recording) {
          recording.stream.stop();
        }
      }
    })
  );
}

function getAllApps(): TappableAppInfo[] {
  if (!shareableContent) {
    return [];
  }

  const apps = shareableContent.applications().map(app => {
    try {
      return {
        rawInstance: app,
        processId: app.processId,
        processGroupId: app.processGroupId,
        bundleIdentifier: app.bundleIdentifier,
        name: app.name,
        isRunning: app.isRunning,
      };
    } catch (error) {
      logger.error('failed to get app info', error);
      return null;
    }
  });

  const filteredApps = apps.filter(
    (v): v is TappableAppInfo =>
      v !== null &&
      !v.bundleIdentifier.startsWith('com.apple') &&
      v.processId !== process.pid
  );

  return filteredApps;
}

type Subscriber = {
  unsubscribe: () => void;
};

function setupMediaListeners() {
  applications$.next(getAllApps());
  subscribers.push(
    ShareableContent.onApplicationListChanged(() => {
      applications$.next(getAllApps());
    })
  );

  let appStateSubscribers: Subscriber[] = [];

  subscribers.push(
    applications$.subscribe(apps => {
      appStateSubscribers.forEach(subscriber => {
        subscriber.unsubscribe();
      });
      const _appStateSubscribers: Subscriber[] = [];

      apps.forEach(app => {
        try {
          const tappableApp = app.rawInstance;
          const debouncedAppStateChanged = debounce(() => {
            applications$.next(getAllApps());
          }, 100);
          _appStateSubscribers.push(
            ShareableContent.onAppStateChanged(tappableApp, () => {
              debouncedAppStateChanged();
            })
          );
        } catch (error) {
          logger.error(
            `Failed to convert app ${app.name} to TappableApplication`,
            error
          );
        }
      });

      appStateSubscribers = _appStateSubscribers;
      return () => {
        _appStateSubscribers.forEach(subscriber => {
          subscriber.unsubscribe();
        });
      };
    })
  );
}

export function setupRecording() {
  if (!isMacOS()) {
    return;
  }

  if (!shareableContent) {
    try {
      shareableContent = new ShareableContent();
      setupMediaListeners();
    } catch (error) {
      logger.error('failed to get shareable content', error);
    }
  }
  setupAppGroups();
  setupNewRunningAppGroup();
  setupRecordingListeners();
}

let recordingId = 0;

export function startRecording(
  appGroup?: AppGroupInfo
): RecordingStatus | undefined {
  if (!shareableContent) {
    return; // likely called on unsupported platform
  }

  // hmm, is it possible that there are multiple apps running (listening) in the same group?
  const appInfo = appGroup?.apps.find(app => app.isRunning);

  const recordingStatus: RecordingStatus = {
    id: recordingId++,
    status: 'recording',
    startTime: Date.now(),
    app: appInfo,
    appGroup,
  };

  recordingStatus$.next(recordingStatus);

  return recordingStatus;
}

export function pauseRecording() {
  const recordingStatus = recordingStatus$.value;
  if (!recordingStatus) {
    return;
  }

  recordingStatus$.next({
    ...recordingStatus,
    status: 'paused',
  });
}

export function resumeRecording() {
  const recordingStatus = recordingStatus$.value;
  if (!recordingStatus) {
    return;
  }

  recordingStatus$.next({
    ...recordingStatus,
    status: 'recording',
  });
}

export function stopRecording() {
  const recordingStatus = recordingStatus$.value;
  if (!recordingStatus) {
    return;
  }

  // do not remove the last recordingStatus from recordingStatus$
  recordingStatus$.next({
    ...recordingStatus,
    status: 'stopped',
  });

  // bring up the window
  getMainWindow()
    .then(mainWindow => {
      if (mainWindow) {
        mainWindow.show();
      }
    })
    .catch(err => {
      logger.error('failed to bring up the window', err);
    });
}

export const recordingHandlers = {
  saveRecording: async (_, id: number) => {
    return saveRecording(id);
  },
} satisfies NamespaceHandlers;

export const recordingEvents = {
  onRecordingStatusChanged: (fn: (status: RecordingStatus | null) => void) => {
    const sub = recordingStatus$.subscribe(fn);
    return () => {
      sub.unsubscribe();
    };
  },
};
