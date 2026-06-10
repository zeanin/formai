import { createContext, useContext } from 'react';

export type RecordData = Record<string, any>;

export const RecordContext = createContext<RecordData | null>(null);

export function useRecord<T extends RecordData = RecordData>(): T | null {
  return useContext(RecordContext) as T | null;
}

export function useRecordField<T = any>(fieldName: string): T | undefined {
  const record = useRecord();
  return record?.[fieldName] as T | undefined;
}

export default useRecord;
