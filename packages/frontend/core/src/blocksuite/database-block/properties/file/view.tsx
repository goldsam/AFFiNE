import { Popover, uniReactRoot } from '@affine/component';
import { Button } from '@affine/component/ui/button';
import { Menu, MenuItem } from '@affine/component/ui/menu';
import { Upload } from '@affine/core/components/pure/file-upload';
import {
  type CellRenderProps,
  createIcon,
  type DataViewCellLifeCycle,
  HostContextKey,
} from '@blocksuite/affine/blocks/database';
import {
  DeleteIcon,
  DownloadIcon,
  FileIcon,
  MoreVerticalIcon,
  PlusIcon,
} from '@blocksuite/icons/rc';
import { generateFractionalIndexingKeyBetween } from '@toeverything/infra';
import type { ForwardRefRenderFunction, MouseEvent, ReactNode } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { useSignal } from '../../../../modules/doc-info/utils';
import type { FileCellType } from './define';
import { filePropertyModelConfig } from './define';
import * as styles from './style.css';

const isImageFile = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase();
  return (
    extension === 'jpg' ||
    extension === 'jpeg' ||
    extension === 'png' ||
    extension === 'gif' ||
    extension === 'webp' ||
    extension === 'svg' ||
    extension === 'bmp'
  );
};

const FileCellComponent: ForwardRefRenderFunction<
  DataViewCellLifeCycle,
  CellRenderProps<{}, FileCellType>
> = (props, ref): ReactNode => {
  const { selectCurrentCell, cell } = props;

  const value = useSignal(cell.value$);
  const isEditing = useSignal(props.isEditing$);
  const fileList = useMemo(
    () =>
      Object.values(value ?? {}).sort((a, b) => (a.order > b.order ? 1 : -1)),
    [value]
  );

  const [readonly] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [fileLoadingStates, setFileLoadingStates] = useState<
    Record<string, boolean>
  >({});

  const loadFileUrl = useCallback(
    async (fileId: string, fileName: string) => {
      if (!isImageFile(fileName)) return;

      if (fileUrls[fileId] || fileLoadingStates[fileId]) return;

      setFileLoadingStates(prev => ({ ...prev, [fileId]: true }));

      try {
        if (cell?.view?.contextGet) {
          const blobSync = cell.view.contextGet(HostContextKey)?.doc.blobSync;
          if (blobSync) {
            try {
              const blob = await blobSync.get(fileId);
              if (blob) {
                const url = URL.createObjectURL(blob);
                setFileUrls(prev => ({ ...prev, [fileId]: url }));
              }
            } catch (error) {
              console.error('Failed to retrieve file', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading file URL', error);
      } finally {
        setFileLoadingStates(prev => ({ ...prev, [fileId]: false }));
      }
    },
    [cell, fileLoadingStates, fileUrls]
  );

  useEffect(() => {
    fileList.forEach(file => {
      if (isImageFile(file.name)) {
        void loadFileUrl(file.id, file.name).catch(err => {
          console.error('Failed to load file URL:', err);
        });
      }
    });
  }, [fileList, loadFileUrl]);

  useEffect(() => {
    return () => {
      Object.values(fileUrls).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [fileUrls]);

  useImperativeHandle(
    ref,
    () => ({
      beforeEnterEditMode: () => {
        return true;
      },
      beforeExitEditingMode: () => {},
      afterEnterEditingMode: () => {},
      focusCell: () => true,
      blurCell: () => true,
      forceUpdate: () => {},
    }),
    []
  );

  const processFileUpload = async (file: File) => {
    try {
      setIsUploading(true);

      let sourceId = Date.now().toString();

      try {
        const blobSync =
          props.cell.view.contextGet(HostContextKey)?.doc.blobSync;
        if (blobSync) {
          const blob = new Blob([await file.arrayBuffer()], {
            type: file.type,
          });
          const uploadedId = await blobSync.set(blob);
          if (uploadedId) {
            sourceId = uploadedId;
          }
        }
      } catch (err) {
        console.error('Failed to get document context', err);
      }

      let order: string;
      const lastFile = fileList[fileList.length - 1];
      order = generateFractionalIndexingKeyBetween(
        lastFile?.order || null,
        null
      );

      const newFile = {
        name: file.name,
        id: sourceId,
        order,
      };

      cell.valueSet({
        ...value,
        [sourceId]: newFile,
      });
    } catch (error) {
      console.error('File upload failed', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = useCallback(
    (fileId: string, e?: MouseEvent) => {
      e?.stopPropagation();
      const value = { ...cell.value$.value };
      delete value[fileId];
      console.log(value);
      cell.valueSet(value);
    },
    [cell]
  );

  const handleDownloadFile = useCallback((fileId: string, e?: MouseEvent) => {
    e?.stopPropagation();
    console.log(fileId);
  }, []);

  const renderFileItem = (
    file: { id: string; name: string },
    isEditable = false
  ) => {
    const fileUrl = fileUrls[file.id];
    const isLoading = fileLoadingStates[file.id];

    const renderFileContent = () => {
      if (isLoading) {
        return <div className={styles.fileImageLoading}>loading...</div>;
      }

      if (isImageFile(file.name)) {
        return (
          <img
            src={fileUrl}
            alt={file.name}
            className={
              isEditable
                ? styles.fileImagePreviewInPopover
                : styles.fileImagePreview
            }
          />
        );
      } else {
        return isEditable ? (
          <FileIcon className={styles.fileIcon} width={24} height={24} />
        ) : (
          <div className={styles.fileCardName}>{file.name}</div>
        );
      }
    };

    const menuItems = (
      <>
        {isImageFile(file.name) && (
          <MenuItem
            onClick={() => {
              console.log('Preview image:', file.id);
            }}
            prefixIcon={<FileIcon width={16} height={16} />}
          >
            Preview
          </MenuItem>
        )}
        <MenuItem
          onClick={e => {
            handleDownloadFile(file.id, e);
          }}
          prefixIcon={<DownloadIcon width={16} height={16} />}
        >
          Download
        </MenuItem>
        <MenuItem
          onClick={e => {
            handleRemoveFile(file.id, e);
          }}
          prefixIcon={<DeleteIcon width={16} height={16} />}
        >
          Delete
        </MenuItem>
      </>
    );

    if (isEditable) {
      return (
        <div className={styles.fileItemContent}>
          {renderFileContent()}
          <div className={styles.fileInfo}>
            <div className={styles.fileName}>{file.name}</div>
          </div>
          <Menu items={menuItems} rootOptions={{ modal: false }}>
            <Button
              variant="plain"
              size="default"
              className={styles.menuButton}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <MoreVerticalIcon width={16} height={16} />
            </Button>
          </Menu>
        </div>
      );
    }

    return renderFileContent();
  };

  const FilePopoverContent = (
    <div className={styles.filePopoverContainer}>
      <div className={styles.filePopoverContent}>
        {isUploading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingWrapper}>
              <div className={styles.loadingSpinner}></div>
              <span>Loading...</span>
            </div>
          </div>
        ) : (
          <>
            {fileList.length === 0 && (
              <>
                <Upload
                  fileChange={file => {
                    void processFileUpload(file).catch(error => {
                      console.error('File upload failed', error);
                    });
                  }}
                >
                  <Button variant="primary" className={styles.uploadButton}>
                    Choose a file
                  </Button>
                </Upload>

                <div className={styles.fileInfoContainer}>
                  <div className={styles.fileSizeInfo}>
                    The maximum size per file is 100MB
                  </div>
                  <a
                    href="#"
                    className={styles.upgradeLink}
                    onClick={e => e.stopPropagation()}
                  >
                    Upgrade to Pro
                  </a>
                </div>
              </>
            )}

            {fileList.length > 0 && (
              <>
                <div>
                  <div className={styles.fileListTitle}>Uploaded files</div>
                  <div className={styles.fileListContainer}>
                    {fileList.map((file: { id: string; name: string }) => (
                      <div key={file.id} className={styles.fileItem}>
                        {renderFileItem(file, true)}
                      </div>
                    ))}
                  </div>
                </div>

                {!readonly && (
                  <Upload
                    fileChange={file => {
                      void processFileUpload(file).catch(error => {
                        console.error('File upload failed', error);
                      });
                    }}
                  >
                    <div className={styles.addFileButton}>
                      <PlusIcon width={14} height={14} />
                      <span>Add another file</span>
                    </div>
                  </Upload>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderMenu = () => {
    return null;
  };

  return (
    <div>
      <Popover
        open={isEditing}
        onOpenChange={open => {
          if (open) {
            selectCurrentCell(true);
          } else {
            selectCurrentCell(false);
          }
        }}
        content={FilePopoverContent}
      >
        <div></div>
      </Popover>
      <div className={styles.cellContainer}>
        {fileList.length === 0 ? null : (
          <div className={styles.fileListCell}>
            {fileList.map(file => (
              <div key={file.id} className={styles.fileItemCell}>
                {renderFileItem(file)}
              </div>
            ))}
          </div>
        )}
      </div>
      {renderMenu()}
    </div>
  );
};

const FileCell = forwardRef(FileCellComponent);
FileCell.displayName = 'FileCell';

export const filePropertyConfig = filePropertyModelConfig.createPropertyMeta({
  icon: createIcon('FileIcon'),
  cellRenderer: {
    view: uniReactRoot.createUniComponent(FileCell),
  },
});
