import React, { useState, useEffect } from 'react';
import { Button, Popconfirm, message, Modal, Upload, Progress, Alert } from 'antd';
import { InboxOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useAPIClient } from '../../providers/APIClientProvider';
import { useFormContext } from '../block/Form';

export interface ActionProps {
  title?: string;
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  htmlType?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void | Promise<void>;
  confirmTitle?: string;
  confirmDescription?: string;
  size?: 'large' | 'middle' | 'small';
  block?: boolean;
  ghost?: boolean;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  
  // Standard actions integration
  action?: 'destroy' | 'submit' | 'custom' | 'export' | 'import' | string;
  collection?: string;
}

export const Action: React.FC<ActionProps> = ({
  title,
  type = 'default',
  htmlType,
  icon,
  danger,
  disabled,
  loading: externalLoading,
  onClick,
  confirmTitle,
  confirmDescription,
  size,
  block,
  ghost,
  style,
  className,
  children,
  action,
  collection,
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<any[]>(() => (window as any).formaiSelectedRowKeys || []);
  const apiClient = useAPIClient();
  const { form } = useFormContext();

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed'>('idle');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileList, setFileList] = useState<any[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      setSelectedKeys((e as CustomEvent).detail || []);
    };
    window.addEventListener('formai-selection-change', handler);
    return () => window.removeEventListener('formai-selection-change', handler);
  }, []);

  const isLoading = externalLoading ?? internalLoading;

  const handleExport = async () => {
    if (!collection) {
      message.error('Collection is not specified for export action');
      return;
    }
    if (!apiClient) {
      message.error('API Client is not available');
      return;
    }

    setInternalLoading(true);
    try {
      // Get current filters
      const filter = (window as any).formaiCurrentFilters?.[collection] || {};
      
      // Request export
      const response = await apiClient.request({
        url: '/api/export:export',
        method: 'POST',
        data: {
          collection,
          filter,
        },
      });

      // Export returns CSV as body or data. Use response data to download
      const csvText = response?.data || '';
      if (!csvText) {
        throw new Error('Export returned empty content');
      }

      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${collection}-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success('Data exported successfully');
    } catch (err: any) {
      console.error('[Action Export] Error:', err);
      // Fallback to GET endpoint if POST fails
      try {
        window.open(`/api/${collection}/export`, '_blank');
      } catch (fallbackErr) {
        message.error(err.message || 'Failed to export data');
      }
    } finally {
      setInternalLoading(false);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!collection) {
      message.error('Collection is not specified for import action');
      return false;
    }
    if (!apiClient) {
      message.error('API Client is not available');
      return false;
    }

    setImportStatus('uploading');
    setImportErrors([]);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target?.result as string;
      if (!csvContent) {
        message.error('Failed to read file content');
        setImportStatus('failed');
        return;
      }

      try {
        setImportStatus('processing');
        // Call import endpoint
        const response = await apiClient.request({
          url: '/api/importJobs:import',
          method: 'POST',
          data: {
            collection,
            filename: file.name,
            csvContent,
          },
        });

        const job = response?.data?.data || response?.data;
        if (!job || !job.id) {
          throw new Error('Failed to create import job');
        }

        // Poll job status
        let pollCount = 0;
        const interval = setInterval(async () => {
          pollCount++;
          try {
            const jobResponse = await apiClient.request({
              url: `/api/importJobs:get?filterByTk=${job.id}`,
              method: 'GET',
            });

            const currentJob = jobResponse?.data?.data || jobResponse?.data;
            if (currentJob) {
              const processed = currentJob.processedRows || 0;
              const total = currentJob.totalRows || 1;
              const pct = Math.min(Math.round((processed / total) * 100), 99);
              setImportProgress(pct);

              if (currentJob.status === 'completed' || currentJob.status === 'failed') {
                clearInterval(interval);
                setImportProgress(100);
                if (currentJob.status === 'completed') {
                  setImportStatus('completed');
                  message.success('CSV import completed successfully');
                  setTimeout(() => {
                    window.location.reload();
                  }, 1500);
                } else {
                  setImportStatus('failed');
                  const errorMsgs = currentJob.errors?.map((err: any) => `Row ${err.row}: ${err.message}`) || ['Unknown import error'];
                  setImportErrors(errorMsgs);
                }
              }
            }

            // Timeout after 60 seconds
            if (pollCount > 60) {
              clearInterval(interval);
              setImportStatus('failed');
              setImportErrors(['Import timeout. The job is still running in the background.']);
            }
          } catch (pollErr) {
            console.error('Polling failed:', pollErr);
          }
        }, 1000);

      } catch (err: any) {
        console.error('[Action Import] Error:', err);
        setImportStatus('failed');
        setImportErrors([err.message || 'Import request failed']);
      }
    };

    reader.onerror = () => {
      message.error('File reading failed');
      setImportStatus('failed');
    };

    reader.readAsText(file);
    return false; // Prevent auto-upload
  };

  const handleClick = async () => {
    if (onClick) {
      setInternalLoading(true);
      try {
        await onClick();
      } finally {
        setInternalLoading(false);
      }
      return;
    }

    const isSubmitAction = 
      action === 'submit' || 
      htmlType === 'submit' || 
      title?.toLowerCase() === 'submit' || 
      (typeof children === 'string' && children.toLowerCase() === 'submit');

    if (isSubmitAction) {
      if (htmlType === 'submit') {
        // Let the browser handle the form submission naturally to avoid double submit
        return;
      }
      if (form) {
        setInternalLoading(true);
        try {
          await form.submit();
        } catch (e) {
          console.error('[Action Submit] Form validation/submission failed:', e);
        } finally {
          setInternalLoading(false);
        }
      } else {
        console.warn('Form context is not available for submit action');
      }
      return;
    }

    if (action === 'export') {
      await handleExport();
      return;
    }

    if (action === 'import') {
      setIsImportModalOpen(true);
      setImportStatus('idle');
      setFileList([]);
      setImportProgress(0);
      setImportErrors([]);
      return;
    }

    if (action === 'destroy') {
      const keys = (window as any).formaiSelectedRowKeys || [];
      if (keys.length === 0) {
        message.warning('Please select records to delete');
        return;
      }

      if (!collection) {
        message.error('Collection is not specified for delete action');
        return;
      }

      if (!apiClient) {
        message.error('API Client is not available');
        return;
      }

      setInternalLoading(true);
      try {
        await apiClient.request({
          url: `/api/${collection}`,
          method: 'DELETE',
          data: { ids: keys },
        });
        message.success('Selected records deleted successfully');
        (window as any).formaiSelectedRowKeys = [];
        window.dispatchEvent(new CustomEvent('formai-selection-change', { detail: [] }));
        window.location.reload();
      } catch (err: any) {
        message.error(err.message || 'Failed to delete records');
      } finally {
        setInternalLoading(false);
      }
    }
  };

  const defaultIcon = action === 'export' ? <DownloadOutlined /> : action === 'import' ? <UploadOutlined /> : icon;
  const defaultTitle = action === 'export' ? 'Export' : action === 'import' ? 'Import' : title;

  const button = (
    <Button
      type={type}
      htmlType={htmlType}
      icon={defaultIcon}
      danger={danger}
      disabled={disabled}
      loading={isLoading}
      size={size}
      block={block}
      ghost={ghost}
      style={style}
      className={className}
      onClick={confirmTitle ? undefined : handleClick}
    >
      {defaultTitle ?? children}
    </Button>
  );

  const importModal = action === 'import' && (
    <Modal
      title={`Import Data to ${collection}`}
      open={isImportModalOpen}
      onCancel={() => setIsImportModalOpen(false)}
      footer={[
        <Button key="close" onClick={() => setIsImportModalOpen(false)}>
          Close
        </Button>,
      ]}
      destroyOnClose
    >
      <div style={{ padding: '16px 0' }}>
        {importStatus === 'idle' && (
          <Upload.Dragger
            accept=".csv"
            multiple={false}
            beforeUpload={handleImportFile}
            fileList={fileList}
            onRemove={() => setFileList([])}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag CSV file to this area to import</p>
            <p className="ant-upload-hint">Only supports standard .csv files</p>
          </Upload.Dragger>
        )}

        {(importStatus === 'uploading' || importStatus === 'processing') && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Progress type="circle" percent={importProgress} status="active" />
            <div style={{ marginTop: 16, fontSize: 16 }}>
              {importStatus === 'uploading' ? 'Uploading file...' : 'Processing import job...'}
            </div>
          </div>
        )}

        {importStatus === 'completed' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Progress type="circle" percent={100} status="success" />
            <div style={{ marginTop: 16, fontSize: 16, color: '#52c41a', fontWeight: 'bold' }}>
              Import Completed Successfully!
            </div>
            <div style={{ marginTop: 8, color: '#888' }}>Reloading page...</div>
          </div>
        )}

        {importStatus === 'failed' && (
          <div>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Progress type="circle" percent={importProgress} status="exception" />
              <div style={{ marginTop: 16, fontSize: 16, color: '#ff4d4f', fontWeight: 'bold' }}>
                Import Failed
              </div>
            </div>
            {importErrors.length > 0 && (
              <Alert
                message="Import Errors"
                description={
                  <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                    {importErrors.map((err, i) => (
                      <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                        • {err}
                      </div>
                    ))}
                  </div>
                }
                type="error"
                showIcon
              />
            )}
            <Button
              type="primary"
              block
              style={{ marginTop: 16 }}
              onClick={() => {
                setImportStatus('idle');
                setImportErrors([]);
                setImportProgress(0);
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );

  const popconfirmWrapper = confirmTitle ? (
    <Popconfirm
      title={confirmTitle}
      description={confirmDescription}
      onConfirm={handleClick}
      disabled={disabled}
    >
      {button}
    </Popconfirm>
  ) : (
    button
  );

  return (
    <>
      {popconfirmWrapper}
      {importModal}
    </>
  );
};

export default Action;
