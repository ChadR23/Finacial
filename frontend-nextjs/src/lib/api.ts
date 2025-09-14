import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}

export interface SummaryData {
  total_income: number;
  total_expenses: number;
  category_totals: Record<string, number>;
  transaction_count: number;
  monthly_totals: Record<string, {
    income: number;
    expenses: number;
    net: number;
  }>;
}

export interface UploadResponse {
  message: string;
  transactions: Transaction[];
  year: string;
  month: string;
  total_transactions: number;
}

export interface MonthData {
  transactions: Transaction[];
  pdf_info: {
    filename: string;
    upload_date: string;
    transaction_count: number;
  } | null;
  processed: boolean;
}

export interface WorkflowStatus {
  total_months: number;
  processed_months: number;
  completed: boolean;
  months: Record<string, boolean>;
}

export const apiClient = {
  // Upload PDF file with year/month
  uploadFile: async (file: File, year: string, month: string): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('year', year);
    formData.append('month', month);
    
    const response = await api.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  // Get available years
  getYears: async (): Promise<string[]> => {
    const response = await api.get<{ years: string[] }>('/years');
    return response.data.years;
  },

  // Get available months for a year
  getMonths: async (year: string): Promise<string[]> => {
    const response = await api.get<{ months: string[] }>(`/months/${year}`);
    return response.data.months;
  },

  // Get transactions for specific year/month
  getTransactionsByMonth: async (year: string, month: string): Promise<MonthData> => {
    const response = await api.get<MonthData>(`/transactions/${year}/${month}`);
    return response.data;
  },

  // Update transaction
  updateTransaction: async (year: string, month: string, id: string, updates: Partial<Transaction>): Promise<Transaction> => {
    const response = await api.put<{ transaction: Transaction }>(`/transactions/${year}/${month}/${id}`, updates);
    return response.data.transaction;
  },

  // Delete transaction
  deleteTransaction: async (year: string, month: string, id: string): Promise<void> => {
    await api.delete(`/transactions/${year}/${month}/${id}`);
  },

  // Add new transaction
  addTransaction: async (year: string, month: string, transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
    const response = await api.post<{ transaction: Transaction }>(`/transactions/${year}/${month}`, transaction);
    return response.data.transaction;
  },

  // Mark month as processed
  markMonthProcessed: async (year: string, month: string): Promise<void> => {
    await api.post(`/transactions/${year}/${month}/process`);
  },

  // Get workflow status
  getWorkflowStatus: async (year: string): Promise<WorkflowStatus> => {
    const response = await api.get<WorkflowStatus>(`/workflow/status/${year}`);
    return response.data;
  },

  // Get categories
  getCategories: async (): Promise<string[]> => {
    const response = await api.get<{ categories: string[] }>('/categories');
    return response.data.categories;
  },

  // Get summary for specific year
  getSummary: async (year: string): Promise<SummaryData> => {
    const response = await api.get<SummaryData>(`/summary/${year}`);
    return response.data;
  },

  // Export PDF for specific year
  exportPDF: async (year: string): Promise<Blob> => {
    const response = await api.get(`/export-pdf/${year}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default apiClient;
