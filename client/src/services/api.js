import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1', // Proxy handled by Vite
});

export const uploadRegulation = async (file, detectionRules = []) => {
    const formData = new FormData();
    formData.append('file', file);
    // Pass detection rules as JSON string so backend can customize parsing
    formData.append('detection_rules', JSON.stringify(detectionRules || []));
    const response = await api.post('/upload', formData);
    return response.data;
};

export const exportReport = async (file, detectionRules = [], tasks = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('detection_rules', JSON.stringify(detectionRules || []));
    if (tasks) {
        formData.append('tasks', JSON.stringify(tasks));
    }
    const response = await api.post('/report', formData, { responseType: 'blob' });
    return response.data;
};
