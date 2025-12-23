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

export const exportReport = async (file, detectionRules = [], tasks = null, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('detection_rules', JSON.stringify(detectionRules || []));
    if (tasks) {
        formData.append('tasks', JSON.stringify(tasks));
    }
    if (options.ruleIds) {
        formData.append('rule_ids', JSON.stringify(options.ruleIds));
    }
    if (options.topN !== undefined && options.topN !== null && options.topN !== '') {
        formData.append('top_n', String(options.topN));
    }
    if (options.scoreCutoff !== undefined && options.scoreCutoff !== null && options.scoreCutoff !== '') {
        formData.append('score_cutoff', String(options.scoreCutoff));
    }
    if (options.severityMap) {
        formData.append('severity_map', JSON.stringify(options.severityMap));
    }
    const response = await api.post('/report', formData, { responseType: 'blob' });
    return response.data;
};
