use std::{ffi::c_void, ptr, sync::Arc};

use block2::{Block, RcBlock};
use core_foundation::{
  array::CFArray,
  base::{CFType, ItemRef, TCFType},
  boolean::CFBoolean,
  dictionary::CFDictionary,
  string::CFString,
  uuid::CFUUID,
};
use coreaudio::sys::{
  kAudioAggregateDeviceIsPrivateKey, kAudioAggregateDeviceIsStackedKey,
  kAudioAggregateDeviceMainSubDeviceKey, kAudioAggregateDeviceNameKey,
  kAudioAggregateDeviceSubDeviceListKey, kAudioAggregateDeviceTapAutoStartKey,
  kAudioAggregateDeviceTapListKey, kAudioAggregateDeviceUIDKey,
  kAudioDevicePropertyAvailableNominalSampleRates, kAudioDevicePropertyNominalSampleRate,
  kAudioHardwareNoError, kAudioHardwarePropertyDefaultInputDevice,
  kAudioHardwarePropertyDefaultSystemOutputDevice, kAudioObjectPropertyElementMain,
  kAudioObjectPropertyScopeGlobal, kAudioSubDeviceUIDKey, kAudioSubTapDriftCompensationKey,
  kAudioSubTapUIDKey, AudioDeviceCreateIOProcIDWithBlock, AudioDeviceDestroyIOProcID,
  AudioDeviceIOProcID, AudioDeviceStart, AudioDeviceStop, AudioHardwareCreateAggregateDevice,
  AudioHardwareDestroyAggregateDevice, AudioObjectGetPropertyData, AudioObjectGetPropertyDataSize,
  AudioObjectID, AudioObjectPropertyAddress, AudioObjectSetPropertyData, AudioTimeStamp, OSStatus,
};
use napi::{
  bindgen_prelude::Float32Array,
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
  Result,
};
use napi_derive::napi;
use objc2::{runtime::AnyObject, Encode, Encoding, RefEncode};

use crate::{
  audio_stream_basic_desc::read_audio_stream_basic_description,
  ca_tap_description::CATapDescription, device::get_device_audio_id, device::get_device_uid,
  error::CoreAudioError, queue::create_audio_tap_queue, screen_capture_kit::TappableApplication,
};

extern "C" {
  fn AudioHardwareCreateProcessTap(
    inDescription: *mut AnyObject,
    outTapID: *mut AudioObjectID,
  ) -> OSStatus;

  fn AudioHardwareDestroyProcessTap(tapID: AudioObjectID) -> OSStatus;
}

/// [Apple's documentation](https://developer.apple.com/documentation/coreaudiotypes/audiobuffer?language=objc)
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
#[allow(non_snake_case)]
pub struct AudioBuffer {
  pub mNumberChannels: u32,
  pub mDataByteSize: u32,
  pub mData: *mut c_void,
}

// Define a struct to represent sample rate ranges
#[repr(C)]
#[allow(non_snake_case)]
struct AudioValueRange {
  mMinimum: f64,
  mMaximum: f64,
}

unsafe impl Encode for AudioBuffer {
  const ENCODING: Encoding = Encoding::Struct(
    "AudioBuffer",
    &[<u32>::ENCODING, <u32>::ENCODING, <*mut c_void>::ENCODING],
  );
}

unsafe impl RefEncode for AudioBuffer {
  const ENCODING_REF: Encoding = Encoding::Pointer(&Self::ENCODING);
}

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
#[allow(non_snake_case)]
pub struct AudioBufferList {
  pub mNumberBuffers: u32,
  pub mBuffers: [AudioBuffer; 1],
}

unsafe impl Encode for AudioBufferList {
  const ENCODING: Encoding = Encoding::Struct(
    "AudioBufferList",
    &[<u32>::ENCODING, <[AudioBuffer; 1]>::ENCODING],
  );
}

unsafe impl RefEncode for AudioBufferList {
  const ENCODING_REF: Encoding = Encoding::Pointer(&Self::ENCODING);
}

// Audio statistics structure to track audio format information
#[derive(Clone, Copy, Debug)]
pub struct AudioStats {
  pub sample_rate: f64,
  pub channels: u32,
}

pub struct AggregateDevice {
  pub tap_id: AudioObjectID,
  pub id: AudioObjectID,
  pub audio_stats: Option<AudioStats>,
  pub input_device_id: Option<AudioObjectID>,
  pub output_device_id: Option<AudioObjectID>,
  pub input_proc_id: Option<AudioDeviceIOProcID>,
  pub output_proc_id: Option<AudioDeviceIOProcID>,
}

impl AggregateDevice {
  pub fn new(app: &TappableApplication) -> Result<Self> {
    let object_id = app.object_id;

    let tap_description = CATapDescription::init_stereo_mixdown_of_processes(object_id)?;
    let mut tap_id: AudioObjectID = 0;

    let status = unsafe { AudioHardwareCreateProcessTap(tap_description.inner, &mut tap_id) };

    if status != 0 {
      return Err(CoreAudioError::CreateProcessTapFailed(status).into());
    }

    let description_dict = Self::create_aggregate_description(tap_id, tap_description.get_uuid()?)?;

    let mut aggregate_device_id: AudioObjectID = 0;

    let status = unsafe {
      AudioHardwareCreateAggregateDevice(
        description_dict.as_concrete_TypeRef().cast(),
        &mut aggregate_device_id,
      )
    };

    if status != 0 {
      return Err(CoreAudioError::CreateAggregateDeviceFailed(status).into());
    }

    Ok(Self {
      tap_id,
      id: aggregate_device_id,
      audio_stats: None,
      input_device_id: None,
      output_device_id: None,
      input_proc_id: None,
      output_proc_id: None,
    })
  }

  pub fn new_from_object_id(object_id: AudioObjectID) -> Result<Self> {
    let mut tap_id: AudioObjectID = 0;

    let tap_description = CATapDescription::init_stereo_mixdown_of_processes(object_id)?;
    let status = unsafe { AudioHardwareCreateProcessTap(tap_description.inner, &mut tap_id) };

    if status != 0 {
      return Err(CoreAudioError::CreateProcessTapFailed(status).into());
    }

    let description_dict = Self::create_aggregate_description(tap_id, tap_description.get_uuid()?)?;

    let mut aggregate_device_id: AudioObjectID = 0;

    let status = unsafe {
      AudioHardwareCreateAggregateDevice(
        description_dict.as_concrete_TypeRef().cast(),
        &mut aggregate_device_id,
      )
    };

    if status != 0 {
      return Err(CoreAudioError::CreateAggregateDeviceFailed(status).into());
    }

    Ok(Self {
      tap_id,
      id: aggregate_device_id,
      audio_stats: None,
      input_device_id: None,
      output_device_id: None,
      input_proc_id: None,
      output_proc_id: None,
    })
  }

  pub fn create_global_tap_but_exclude_processes(processes: &[AudioObjectID]) -> Result<Self> {
    let mut tap_id: AudioObjectID = 0;
    let tap_description =
      CATapDescription::init_stereo_global_tap_but_exclude_processes(processes)?;
    let status = unsafe { AudioHardwareCreateProcessTap(tap_description.inner, &mut tap_id) };

    if status != 0 {
      return Err(CoreAudioError::CreateProcessTapFailed(status).into());
    }

    // Get the default input device (microphone) UID and ID
    let input_device_id = get_device_audio_id(kAudioHardwarePropertyDefaultInputDevice)?;

    // Get the default output device ID
    let output_device_id = get_device_audio_id(kAudioHardwarePropertyDefaultSystemOutputDevice)?;

    let description_dict = Self::create_aggregate_description(tap_id, tap_description.get_uuid()?)?;

    let mut aggregate_device_id: AudioObjectID = 0;

    let status = unsafe {
      AudioHardwareCreateAggregateDevice(
        description_dict.as_concrete_TypeRef().cast(),
        &mut aggregate_device_id,
      )
    };

    // Check the status and return the appropriate result
    if status != 0 {
      return Err(CoreAudioError::CreateAggregateDeviceFailed(status).into());
    }

    // Create a device with stored device IDs
    let mut device = Self {
      tap_id,
      id: aggregate_device_id,
      audio_stats: None,
      input_device_id: Some(input_device_id),
      output_device_id: Some(output_device_id),
      input_proc_id: None,
      output_proc_id: None,
    };

    // Configure the aggregate device to ensure proper handling of both input and output
    device.configure_aggregate_device()?;

    // Activate both the input and output devices and store their proc IDs
    let input_proc_id = device.activate_audio_device(input_device_id)?;
    let output_proc_id = device.activate_audio_device(output_device_id)?;

    device.input_proc_id = Some(input_proc_id);
    device.output_proc_id = Some(output_proc_id);

    Ok(device)
  }

  // Configures the aggregate device to ensure proper handling of both input and output streams
  fn configure_aggregate_device(&self) -> Result<AudioStats> {
    // Read the current audio format to ensure it's properly configured
    let audio_format = read_audio_stream_basic_description(self.tap_id)?;

    // Create initial audio stats with the actual sample rate but always use mono
    let initial_sample_rate = audio_format.0.mSampleRate;
    let mut audio_stats = AudioStats {
      sample_rate: initial_sample_rate,
      channels: 1, // Always set to 1 channel (mono)
    };

    // Set the preferred sample rate on the device
    // This is similar to how Screen Capture Kit allows setting the sample rate
    let preferred_sample_rate = initial_sample_rate; // Use the device's current sample rate

    // First, check if the preferred sample rate is available
    let mut is_sample_rate_available = false;
    let mut best_available_rate = preferred_sample_rate; // Default to preferred rate

    unsafe {
      // Get the available sample rates
      let address = AudioObjectPropertyAddress {
        mSelector: kAudioDevicePropertyAvailableNominalSampleRates,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain,
      };

      // Get the size of the property data
      let mut data_size: u32 = 0;
      let status = AudioObjectGetPropertyDataSize(
        self.id,
        &address as *const AudioObjectPropertyAddress,
        0,
        std::ptr::null(),
        &mut data_size as *mut u32,
      );

      if status == 0 && data_size > 0 {
        // Calculate how many ranges we have
        let range_count = data_size as usize / std::mem::size_of::<AudioValueRange>();

        // Allocate memory for the ranges
        let mut ranges: Vec<AudioValueRange> = Vec::with_capacity(range_count);
        ranges.set_len(range_count);

        // Get the available sample rates
        let status = AudioObjectGetPropertyData(
          self.id,
          &address as *const AudioObjectPropertyAddress,
          0,
          std::ptr::null(),
          &mut data_size as *mut u32,
          ranges.as_mut_ptr() as *mut std::ffi::c_void,
        );

        if status == 0 {
          // Check if our preferred sample rate is within any of the available ranges
          for range in &ranges {
            if preferred_sample_rate >= range.mMinimum && preferred_sample_rate <= range.mMaximum {
              is_sample_rate_available = true;
              break;
            }
          }

          // If not available, find the best available rate
          if !is_sample_rate_available && !ranges.is_empty() {
            // Common preferred sample rates in order of preference
            let common_rates = [48000.0, 44100.0, 96000.0, 88200.0, 24000.0, 22050.0];
            let mut found_common_rate = false;

            // First try to find a common rate that's available
            for &rate in &common_rates {
              for range in &ranges {
                if rate >= range.mMinimum && rate <= range.mMaximum {
                  best_available_rate = rate;
                  found_common_rate = true;
                  break;
                }
              }
              if found_common_rate {
                break;
              }
            }

            // If no common rate is available, use the highest available rate
            if !found_common_rate {
              // Find the highest available rate
              for range in &ranges {
                // Use the maximum of the range as our best available rate
                if range.mMaximum > best_available_rate {
                  best_available_rate = range.mMaximum;
                }
              }
            }
          }
        }
      }
    }

    // Set the sample rate to either the preferred rate or the best available rate
    let sample_rate_to_set = if is_sample_rate_available {
      preferred_sample_rate
    } else {
      best_available_rate
    };

    let status = unsafe {
      // Note on scope usage:
      // We use kAudioObjectPropertyScopeGlobal here because it works reliably for setting
      // the nominal sample rate on the device. While kAudioObjectPropertyScopeInput or
      // kAudioObjectPropertyScopeOutput might also work in some cases (as mentioned in the
      // comments), kAudioObjectPropertyScopeGlobal is the most consistent approach.
      //
      // The CoreAudio documentation doesn't explicitly specify which scope to use with
      // kAudioDevicePropertyNominalSampleRate, but in practice, kAudioObjectPropertyScopeGlobal
      // ensures the sample rate is set for the entire device, affecting both input and output.
      let address = AudioObjectPropertyAddress {
        mSelector: kAudioDevicePropertyNominalSampleRate,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain,
      };

      // Set the sample rate property
      AudioObjectSetPropertyData(
        self.id,
        &address as *const AudioObjectPropertyAddress,
        0,
        std::ptr::null(),
        std::mem::size_of::<f64>() as u32,
        &sample_rate_to_set as *const f64 as *const std::ffi::c_void,
      )
    };

    // Update the audio_stats with the actual sample rate that was set if successful
    if status == 0 {
      audio_stats.sample_rate = sample_rate_to_set;

      // Verify the actual sample rate by reading it back
      unsafe {
        let address = AudioObjectPropertyAddress {
          mSelector: kAudioDevicePropertyNominalSampleRate,
          mScope: kAudioObjectPropertyScopeGlobal,
          mElement: kAudioObjectPropertyElementMain,
        };

        let mut actual_rate: f64 = 0.0;
        let mut data_size = std::mem::size_of::<f64>() as u32;

        let status = AudioObjectGetPropertyData(
          self.id,
          &address as *const AudioObjectPropertyAddress,
          0,
          std::ptr::null(),
          &mut data_size as *mut u32,
          &mut actual_rate as *mut f64 as *mut std::ffi::c_void,
        );

        if status == 0 {
          // Update with the verified rate
          audio_stats.sample_rate = actual_rate;
        }
      }
    }

    Ok(audio_stats)
  }

  // Activates an audio device by creating a dummy IO proc
  fn activate_audio_device(&self, device_id: AudioObjectID) -> Result<AudioDeviceIOProcID> {
    // Create a simple no-op dummy proc
    let dummy_block = RcBlock::new(
      |_: *mut c_void, _: *mut c_void, _: *mut c_void, _: *mut c_void, _: *mut c_void| {
        // No-op function that just returns success
        kAudioHardwareNoError as i32
      },
    );

    let mut dummy_proc_id: AudioDeviceIOProcID = None;

    // Create the IO proc with our dummy block
    let status = unsafe {
      AudioDeviceCreateIOProcIDWithBlock(
        &mut dummy_proc_id,
        device_id,
        ptr::null_mut(),
        (&*dummy_block.copy() as *const Block<dyn Fn(_, _, _, _, _) -> i32>)
          .cast_mut()
          .cast(),
      )
    };

    if status != 0 {
      return Err(CoreAudioError::CreateIOProcIDWithBlockFailed(status).into());
    }

    // Start the device to activate it
    let status = unsafe { AudioDeviceStart(device_id, dummy_proc_id) };
    if status != 0 {
      return Err(CoreAudioError::AudioDeviceStartFailed(status).into());
    }

    // Return the proc ID for later cleanup
    Ok(dummy_proc_id)
  }

  pub fn start(
    &mut self,
    audio_stream_callback: Arc<ThreadsafeFunction<Float32Array, (), Float32Array, true>>,
  ) -> Result<AudioTapStream> {
    // Configure the aggregate device and get audio stats before starting
    let audio_stats = self.configure_aggregate_device()?;
    self.audio_stats = Some(audio_stats);
    let audio_stats_clone = audio_stats;

    let queue = create_audio_tap_queue();
    let mut in_proc_id: AudioDeviceIOProcID = None;

    let in_io_block: RcBlock<
      dyn Fn(*mut c_void, *mut c_void, *mut c_void, *mut c_void, *mut c_void) -> i32,
    > = RcBlock::new(
      move |_in_now: *mut c_void,
            in_input_data: *mut c_void,
            in_input_time: *mut c_void,
            _out_output_data: *mut c_void,
            _in_output_time: *mut c_void| {
        let AudioTimeStamp { mSampleTime, .. } = unsafe { &*in_input_time.cast() };

        // ignore pre-roll
        if *mSampleTime < 0.0 {
          return kAudioHardwareNoError as i32;
        }
        let AudioBufferList { mBuffers, .. } =
          unsafe { &mut *in_input_data.cast::<AudioBufferList>() };
        let [AudioBuffer {
          mData,
          mNumberChannels,
          mDataByteSize,
        }] = mBuffers;
        // Only create slice if we have valid data
        if !mData.is_null() && *mDataByteSize > 0 {
          // Calculate total number of samples (total bytes / bytes per sample)
          let total_samples = *mDataByteSize as usize / 4; // 4 bytes per f32

          // Create a slice of all samples
          let samples: &[f32] =
            unsafe { std::slice::from_raw_parts(mData.cast::<f32>(), total_samples) };

          // Check the channel count and data format
          let channel_count = *mNumberChannels as usize;

          // Process the audio based on channel count
          let processed_samples: Vec<f32>;

          if channel_count > 1 {
            // For stereo, samples are interleaved: [L, R, L, R, ...]
            // We need to average each pair to get mono
            processed_samples = process_mixed_audio(samples, channel_count);
          } else {
            // For mono, just copy the samples
            processed_samples = samples.to_vec();
          }

          // Send the processed audio data to JavaScript
          audio_stream_callback.call(
            Ok(processed_samples.into()),
            ThreadsafeFunctionCallMode::NonBlocking,
          );
        }

        kAudioHardwareNoError as i32
      },
    );

    let status = unsafe {
      AudioDeviceCreateIOProcIDWithBlock(
        &mut in_proc_id,
        self.id,
        queue.cast(),
        (&*in_io_block
          as *const Block<
            dyn Fn(*mut c_void, *mut c_void, *mut c_void, *mut c_void, *mut c_void) -> i32,
          >)
          .cast_mut()
          .cast(),
      )
    };
    if status != 0 {
      return Err(CoreAudioError::CreateIOProcIDWithBlockFailed(status).into());
    }
    let status = unsafe { AudioDeviceStart(self.id, in_proc_id) };
    if status != 0 {
      return Err(CoreAudioError::AudioDeviceStartFailed(status).into());
    }

    Ok(AudioTapStream {
      device_id: self.id,
      in_proc_id,
      stop_called: false,
      audio_stats: audio_stats_clone, // Use the updated audio_stats with the actual sample rate
      input_device_id: self.input_device_id,
      output_device_id: self.output_device_id,
      input_proc_id: self.input_proc_id,
      output_proc_id: self.output_proc_id,
    })
  }

  fn create_aggregate_description(
    tap_id: AudioObjectID,
    tap_uuid_string: ItemRef<CFString>,
  ) -> Result<CFDictionary<CFType, CFType>> {
    let system_output_uid = get_device_uid(kAudioHardwarePropertyDefaultSystemOutputDevice)?;
    let default_input_uid = get_device_uid(kAudioHardwarePropertyDefaultInputDevice)?;

    let aggregate_device_name = CFString::new(&format!("Tap-{}", tap_id));
    let aggregate_device_uid: uuid::Uuid = CFUUID::new().into();
    let aggregate_device_uid_string = aggregate_device_uid.to_string();

    // Sub-device UID key and dictionary
    let sub_device_output_dict = CFDictionary::from_CFType_pairs(&[
      (
        cfstring_from_bytes_with_nul(kAudioSubDeviceUIDKey).as_CFType(),
        system_output_uid.as_CFType(),
      ),
      // Explicitly mark this as an output device
      (
        CFString::new("com.apple.audio.roles").as_CFType(),
        CFString::new("output").as_CFType(),
      ),
    ]);

    let sub_device_input_dict = CFDictionary::from_CFType_pairs(&[
      (
        cfstring_from_bytes_with_nul(kAudioSubDeviceUIDKey).as_CFType(),
        default_input_uid.as_CFType(),
      ),
      // Explicitly mark this as an input device
      (
        CFString::new("com.apple.audio.roles").as_CFType(),
        CFString::new("input").as_CFType(),
      ),
    ]);

    let tap_device_dict = CFDictionary::from_CFType_pairs(&[
      (
        cfstring_from_bytes_with_nul(kAudioSubTapDriftCompensationKey).as_CFType(),
        CFBoolean::false_value().as_CFType(),
      ),
      (
        cfstring_from_bytes_with_nul(kAudioSubTapUIDKey).as_CFType(),
        tap_uuid_string.as_CFType(),
      ),
    ]);

    // Put input device first in the list to prioritize it
    let capture_device_list = vec![sub_device_input_dict, sub_device_output_dict];

    // Sub-device list
    let sub_device_list = CFArray::from_CFTypes(&capture_device_list);

    let tap_list = CFArray::from_CFTypes(&[tap_device_dict]);

    // Create the aggregate device description dictionary with a balanced configuration
    let description_dict = CFDictionary::from_CFType_pairs(&[
      (
        cfstring_from_bytes_with_nul(kAudioAggregateDeviceNameKey).as_CFType(),
        aggregate_device_name.as_CFType(),
      ),
      (
        cfstring_from_bytes_with_nul(kAudioAggregateDeviceUIDKey).as_CFType(),
        CFString::new(aggregate_device_uid_string.as_str()).as_CFType(),
      ),
      (
        cfstring_from_bytes_with_nul(kAudioAggregateDeviceMainSubDeviceKey).as_CFType(),
        // Use a balanced approach that includes both input and output
        // but prioritize input for microphone capture
        default_input_uid.as_CFType(),
      ),
      (
        cfstring_from_bytes_with_nul(kAudioAggregateDeviceIsPrivateKey).as_CFType(),
        CFBoolean::true_value().as_CFType(),
      ),
      (
        cfstring_from_bytes_with_nul(kAudioAggregateDeviceIsStackedKey).as_CFType(),
        CFBoolean::false_value().as_CFType(),
      ),
      (
        cfstring_from_bytes_with_nul(kAudioAggregateDeviceTapAutoStartKey).as_CFType(),
        CFBoolean::true_value().as_CFType(),
      ),
      (
        cfstring_from_bytes_with_nul(kAudioAggregateDeviceSubDeviceListKey).as_CFType(),
        sub_device_list.as_CFType(),
      ),
      (
        cfstring_from_bytes_with_nul(kAudioAggregateDeviceTapListKey).as_CFType(),
        tap_list.as_CFType(),
      ),
    ]);
    Ok(description_dict)
  }
}

#[napi]
pub struct AudioTapStream {
  device_id: AudioObjectID,
  in_proc_id: AudioDeviceIOProcID,
  stop_called: bool,
  audio_stats: AudioStats,
  input_device_id: Option<AudioObjectID>,
  output_device_id: Option<AudioObjectID>,
  input_proc_id: Option<AudioDeviceIOProcID>,
  output_proc_id: Option<AudioDeviceIOProcID>,
}

#[napi]
impl AudioTapStream {
  #[napi]
  pub fn stop(&mut self) -> Result<()> {
    if self.stop_called {
      return Ok(());
    }
    self.stop_called = true;

    // Stop the main aggregate device
    let status = unsafe { AudioDeviceStop(self.device_id, self.in_proc_id) };
    if status != 0 {
      return Err(CoreAudioError::AudioDeviceStopFailed(status).into());
    }

    // Stop the input device if it was activated
    if let Some(input_id) = self.input_device_id {
      if let Some(proc_id) = self.input_proc_id {
        let _ = unsafe { AudioDeviceStop(input_id, proc_id) };
        let _ = unsafe { AudioDeviceDestroyIOProcID(input_id, proc_id) };
      }
    }

    // Stop the output device if it was activated
    if let Some(output_id) = self.output_device_id {
      if let Some(proc_id) = self.output_proc_id {
        let _ = unsafe { AudioDeviceStop(output_id, proc_id) };
        let _ = unsafe { AudioDeviceDestroyIOProcID(output_id, proc_id) };
      }
    }

    // Destroy the main IO proc
    let status = unsafe { AudioDeviceDestroyIOProcID(self.device_id, self.in_proc_id) };
    if status != 0 {
      return Err(CoreAudioError::AudioDeviceDestroyIOProcIDFailed(status).into());
    }

    // Destroy the aggregate device
    let status = unsafe { AudioHardwareDestroyAggregateDevice(self.device_id) };
    if status != 0 {
      return Err(CoreAudioError::AudioHardwareDestroyAggregateDeviceFailed(status).into());
    }

    // Destroy the process tap
    let status = unsafe { AudioHardwareDestroyProcessTap(self.device_id) };
    if status != 0 {
      return Err(CoreAudioError::AudioHardwareDestroyProcessTapFailed(status).into());
    }

    Ok(())
  }

  #[napi(getter)]
  pub fn get_sample_rate(&self) -> f64 {
    self.audio_stats.sample_rate
  }

  #[napi(getter)]
  pub fn get_channels(&self) -> u32 {
    self.audio_stats.channels
  }
}

fn cfstring_from_bytes_with_nul(bytes: &'static [u8]) -> CFString {
  CFString::new(
    unsafe { std::ffi::CStr::from_bytes_with_nul_unchecked(bytes) }
      .to_string_lossy()
      .as_ref(),
  )
}

// Process mixed audio from multiple channels
fn process_mixed_audio(samples: &[f32], channel_count: usize) -> Vec<f32> {
  // For stereo or multi-channel audio, we need to mix down to mono
  let samples_per_channel = samples.len() / channel_count;
  let mut mixed_samples = Vec::with_capacity(samples_per_channel);

  for i in 0..samples_per_channel {
    let mut sample_sum = 0.0;
    for c in 0..channel_count {
      sample_sum += samples[i * channel_count + c];
    }
    // Average the samples from all channels
    mixed_samples.push(sample_sum / channel_count as f32);
  }

  mixed_samples
}
