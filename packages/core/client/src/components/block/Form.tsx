import React, { createContext, useContext, useRef } from 'react';
import { Form as AntForm, message } from 'antd';
import type { FormInstance } from 'antd';
import { useAPIClient } from '../../providers/APIClientProvider';

export interface FormProps {
  collection?: string;
  layout?: 'horizontal' | 'vertical' | 'inline';
  labelCol?: { span?: number };
  wrapperCol?: { span?: number };
  initialValues?: Record<string, any>;
  onSubmit?: (values: Record<string, any>) => void;
  onValuesChange?: (changedValues: any, allValues: any) => void;
  disabled?: boolean;
  colon?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface FormContextValue {
  form: FormInstance | null;
  layout: 'horizontal' | 'vertical' | 'inline';
  labelCol?: { span?: number };
  wrapperCol?: { span?: number };
  disabled?: boolean;
}

export const FormContext = createContext<FormContextValue>({
  form: null,
  layout: 'vertical',
});

export const useFormContext = () => useContext(FormContext);

export const Form: React.FC<FormProps> = ({
  collection,
  layout = 'vertical',
  labelCol,
  wrapperCol,
  initialValues,
  onSubmit,
  onValuesChange,
  disabled,
  colon,
  style,
  children,
}) => {
  const [form] = AntForm.useForm();
  const apiClient = useAPIClient();

  const handleFinish = async (values: any) => {
    if (onSubmit) {
      onSubmit(values);
    } else if (collection && apiClient) {
      const hide = message.loading('Saving data...', 0);
      try {
        console.log(`[Form] Submitting data to /api/${collection}`, values);
        await apiClient.request({
          url: `/api/${collection}`,
          method: 'POST',
          data: { values },
        });
        hide();
        message.success('Data saved successfully');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err: any) {
        hide();
        const errMsg = err?.response?.data?.errors?.[0]?.message || err.message || 'Failed to save data';
        message.error(`Save failed: ${errMsg}`, 5);
        console.error('[Form] Failed to submit form:', err);
      }
    }
  };

  const contextValue: FormContextValue = {
    form,
    layout,
    labelCol,
    wrapperCol,
    disabled,
  };

  return (
    <FormContext.Provider value={contextValue}>
      <AntForm
        form={form}
        layout={layout}
        labelCol={labelCol}
        wrapperCol={wrapperCol}
        initialValues={initialValues}
        onFinish={handleFinish}
        onValuesChange={onValuesChange}
        disabled={disabled}
        colon={colon}
        style={style}
      >
        {children}
      </AntForm>
    </FormContext.Provider>
  );
};

export default Form;

