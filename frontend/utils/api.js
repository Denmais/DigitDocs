import { API_CONFIG } from '../constants/api.js';

export class ApiService {

  static async uploadFile(file, typeId, comment = '') {
    const formData = new FormData();

    // Тип документа (категория)
    formData.append('type_id', typeId);

    // Сам PDF-файл
    formData.append('file', file);

    // Необязательный комментарий
    if (comment) {
      formData.append('comment', comment);
    }

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`,
      {
        method: 'POST',
        body: formData,
        headers: API_CONFIG.DEFAULT_HEADERS,
      }
    );

    // Обработка ошибки HTTP
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return await response.json();
  }


  static async getUploadStatus(uploadId) {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STATUS}/${uploadId}`,
      {
        headers: API_CONFIG.DEFAULT_HEADERS,
      }
    );

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    return await response.json();
  }


  static async processDocument(uploadId) {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROCESS}`,
      {
        method: 'POST',
        headers: {
          ...API_CONFIG.DEFAULT_HEADERS,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_id: uploadId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Process failed: ${response.status}`);
    }

    return await response.json();
  }
}
