import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getMobileApiBaseUrl, getMobileApiTokens, resolveMobilePublicUrl } from './apiClient';

type SaveFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<SaveFileHandle>;
};

function isProtectedUpload(url: URL) {
  const apiUrl = new URL(getMobileApiBaseUrl());
  return url.origin === apiUrl.origin && url.pathname.startsWith('/uploads/');
}

function buildAttachmentUrl(value: string, fileName: string, download: boolean) {
  const url = new URL(resolveMobilePublicUrl(value));
  const token = getMobileApiTokens()?.accessToken;
  if (token && isProtectedUpload(url)) url.searchParams.set('access_token', token);
  if (download && isProtectedUpload(url)) {
    url.searchParams.set('download', '1');
    url.searchParams.set('downloadAs', fileName);
  }
  return url;
}

function getMimeType(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    '7z': 'application/x-7z-compressed',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    pdf: 'application/pdf',
    png: 'image/png',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    rar: 'application/vnd.rar',
    txt: 'text/plain',
    wav: 'audio/wav',
    webm: 'video/webm',
    webp: 'image/webp',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip',
  };
  return (extension && mimeTypes[extension]) || 'application/octet-stream';
}

function downloadInBrowser(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

export async function openChatAttachment(value: string) {
  const url = buildAttachmentUrl(value, '', false);
  await Linking.openURL(url.toString());
}

export async function downloadChatAttachment(value: string, fileName: string) {
  const url = buildAttachmentUrl(value, fileName, true);
  const token = getMobileApiTokens()?.accessToken;
  if (!token && isProtectedUpload(url)) throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');

  if (Platform.OS === 'web') {
    const pickerWindow = window as SaveFilePickerWindow;
    let saveHandle: SaveFileHandle | null = null;
    if (pickerWindow.showSaveFilePicker) {
      try {
        saveHandle = await pickerWindow.showSaveFilePicker({ suggestedName: fileName });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        throw error;
      }
    }
    const response = await fetch(url.toString(), {
      credentials: 'include',
      headers: token && isProtectedUpload(url) ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error(`Không tải được tệp (HTTP ${response.status}).`);
    const blob = await response.blob();
    if (saveHandle) {
      const writable = await saveHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
    downloadInBrowser(blob, fileName);
    return;
  }

  if (!FileSystem.cacheDirectory) throw new Error('Không thể truy cập vùng lưu tệp trên thiết bị.');
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const temporaryUri = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;
  try {
    const headers = isProtectedUpload(url) ? { Authorization: `Bearer ${token}` } : undefined;
    const result = await FileSystem.downloadAsync(url.toString(), temporaryUri, { headers });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Không tải được tệp (HTTP ${result.status}).`);
    }

    if (Platform.OS === 'android') {
      const directory = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!directory.granted) return;
      const nameWithoutExtension = safeName.replace(/\.[^.]+$/, '');
      const destination = await FileSystem.StorageAccessFramework.createFileAsync(
        directory.directoryUri,
        nameWithoutExtension,
        getMimeType(safeName),
      );
      await FileSystem.copyAsync({ from: result.uri, to: destination });
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Thiết bị không hỗ trợ hộp thoại lưu tệp.');
    }
    await Sharing.shareAsync(result.uri, {
      mimeType: getMimeType(safeName),
      dialogTitle: `Lưu ${safeName}`,
    });
  } finally {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
  }
}
