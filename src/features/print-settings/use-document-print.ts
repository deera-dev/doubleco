import {
  type PrintedDocument,
  usePrintMarks,
  useRecordDocumentPrint,
} from '@/features/print-settings/api'
import { describePrintMark } from '@/features/print-settings/PrintMark'

/** Print-page wiring: the "already printed" note, and a print record each time it is printed. */
export function useDocumentPrint(documentType: PrintedDocument, documentKey: string) {
  const marks = usePrintMarks(documentType, [documentKey])
  const record = useRecordDocumentPrint()
  const mark = marks.data?.marks[documentKey]
  return {
    printedNote: mark ? describePrintMark(mark) : undefined,
    onPrinted: () => record.mutate({ documentType, documentKey }),
  }
}
