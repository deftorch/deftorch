import { useState, useEffect } from 'react';
import { extractCode } from '@/lib/extract-code';
import { useUIStore } from '@/lib/store/ui-store';
import { RendererType } from '@/types';

interface Message {
  type: string;
  content: string;
}

interface CodeVersion {
  code: string;
  renderer: RendererType;
  messageIndex: number;
  versionNumber: number;
}

export function useVersionHistory(messages: Message[]) {
  const ui = useUIStore();
  const [codeVersions, setCodeVersions] = useState<CodeVersion[]>([]);

  const getVersionsFromMessages = (msgs: Message[]): CodeVersion[] => {
    const list: CodeVersion[] = [];
    let versionCounter = 1;
    msgs.forEach((msg, idx) => {
      if (msg.type === 'ai') {
        const extracted = extractCode(msg.content);
        if (extracted) {
          list.push({
            code: extracted.code,
            renderer: extracted.renderer,
            messageIndex: idx,
            versionNumber: versionCounter++,
          });
        }
      }
    });
    return list;
  };

  useEffect(() => {
    const extractedVersions = getVersionsFromMessages(messages);

    const versionCountChanged = extractedVersions.length !== codeVersions.length;

    let changedVersionNumber: number | null = null;
    if (extractedVersions.length === codeVersions.length) {
      for (let i = 0; i < extractedVersions.length; i++) {
        if (!codeVersions[i] || extractedVersions[i].code !== codeVersions[i].code) {
          changedVersionNumber = extractedVersions[i].versionNumber;
          break;
        }
      }
    }

    setCodeVersions(extractedVersions);

    if (extractedVersions.length > 0) {
      if (versionCountChanged) {
        ui.setActiveVersionNumber(extractedVersions[extractedVersions.length - 1].versionNumber);
      } else if (changedVersionNumber !== null) {
        ui.setActiveVersionNumber(changedVersionNumber);
      } else {
        const prev = ui.activeVersionNumber;
        if (prev !== null && extractedVersions.some((v) => v.versionNumber === prev)) {
          ui.setActiveVersionNumber(prev);
        } else {
          ui.setActiveVersionNumber(extractedVersions[extractedVersions.length - 1].versionNumber);
        }
      }
    } else {
      ui.setActiveVersionNumber(null);
    }
  }, [messages]);

  useEffect(() => {
    if (ui.activeVersionNumber !== null && codeVersions.length > 0) {
      const activeVer = codeVersions.find((v) => v.versionNumber === ui.activeVersionNumber);
      if (activeVer) {
        ui.setP5Code(activeVer.code);
        ui.setEditableCode(activeVer.code);
        ui.setActiveRenderer(activeVer.renderer);

        const prevVer = codeVersions.find((v) => v.versionNumber === ui.activeVersionNumber! - 1);
        ui.setPreviousCode(prevVer ? prevVer.code : '');
      }
    }
  }, [ui.activeVersionNumber, codeVersions]);

  return { codeVersions, getVersionsFromMessages };
}
