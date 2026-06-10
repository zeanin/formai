import React from 'react';
import { Upload as AntUpload, Button, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps as AntUploadProps } from 'antd';

export interface UploadProps {
  value?: UploadFile[];
  defaultValue?: UploadFile[];
  onChange?: (fileList: UploadFile[]) => void;
  accept?: string;
  multiple?: boolean;
  maxCount?: number;
  disabled?: boolean;
  readPretty?: boolean;
  listType?: 'text' | 'picture' | 'picture-card' | 'picture-circle';
  action?: string;
  beforeUpload?: AntUploadProps['beforeUpload'];
  customRequest?: AntUploadProps['customRequest'];
  buttonText?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const Upload: React.FC<UploadProps> = ({
  value,
  defaultValue,
  onChange,
  accept,
  multiple,
  maxCount,
  disabled,
  readPretty,
  listType = 'text',
  action,
  beforeUpload,
  customRequest,
  buttonText = 'Upload',
  style,
  className,
}) => {
  const handleChange: AntUploadProps['onChange'] = (info) => {
    onChange?.(info.fileList);
  };

  if (readPretty) {
    const files = value ?? defaultValue ?? [];
    if (files.length === 0) {
      return <Typography.Text style={style}>-</Typography.Text>;
    }
    return (
      <div style={style}>
        {files.map((file) => (
          <div key={file.uid}>
            <Typography.Link href={file.url} target="_blank">
              {file.name}
            </Typography.Link>
          </div>
        ))}
      </div>
    );
  }

  return (
    <AntUpload
      fileList={value}
      defaultFileList={defaultValue}
      onChange={handleChange}
      accept={accept}
      multiple={multiple}
      maxCount={maxCount}
      disabled={disabled}
      listType={listType}
      action={action}
      beforeUpload={beforeUpload}
      customRequest={customRequest}
      style={style}
      className={className}
    >
      {listType === 'picture-card' || listType === 'picture-circle' ? (
        <div>
          <UploadOutlined />
          <div style={{ marginTop: 8 }}>{buttonText}</div>
        </div>
      ) : (
        <Button icon={<UploadOutlined />} disabled={disabled}>
          {buttonText}
        </Button>
      )}
    </AntUpload>
  );
};

export default Upload;
