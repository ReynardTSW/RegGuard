import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1', // Proxy handled by Vite
});

export const uploadRegulation = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload', formData);
    return response.data;
};
