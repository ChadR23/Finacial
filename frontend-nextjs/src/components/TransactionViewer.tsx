'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, FileText, Edit3, Plus, Trash2, Save, X, ArrowRight } from 'lucide-react';
import { apiClient, Transaction, WorkflowStatus } from '@/lib/api';

interface PDFFile {
  file: File;
  detectedMonth: string;
  selectedMonth: string;
  processed: boolean;
  transactions?: Transaction[];
}

interface TransactionViewerProps {
  transactions: Transaction[];
  uploadedFile: File | null;
  currentYear: string;
  currentMonth: string;
  pdfQueue: PDFFile[];
  currentPdfIndex: number;
  onTransactionUpdate: (transaction: Transaction) => void;
  onNextPdf: () => void;
}

interface NewTransaction {
  date: string;
  description: string;
  amount: string;
  category: string;
}

export default function TransactionViewer({ 
  transactions, 
  uploadedFile,
  currentYear,
  currentMonth,
  pdfQueue,
  currentPdfIndex,
  onTransactionUpdate,
  onNextPdf
}: TransactionViewerProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>(transactions);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTransaction, setNewTransaction] = useState<NewTransaction>({
    date: '',
    description: '',
    amount: '',
    category: 'Uncategorized'
  });
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchWorkflowStatus();
  }, []);

  useEffect(() => {
    setLocalTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    if (uploadedFile && uploadedFile instanceof File) {
      const fileUrl = URL.createObjectURL(uploadedFile);
      setPdfUrl(fileUrl);
      
      // Cleanup function
      return () => {
        URL.revokeObjectURL(fileUrl);
      };
    }
  }, [uploadedFile]);

  const fetchCategories = async () => {
    try {
      const categoriesData = await apiClient.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchWorkflowStatus = async () => {
    try {
      const status = await apiClient.getWorkflowStatus(currentYear);
      setWorkflowStatus(status);
    } catch (error) {
      console.error('Error fetching workflow status:', error);
    }
  };

  const handleCategoryChange = async (transactionId: string, newCategory: string) => {
    setLoading(true);
    try {
      const updatedTransaction = await apiClient.updateTransaction(currentYear, currentMonth, transactionId, {
        category: newCategory
      });
      setLocalTransactions(prev => 
        prev.map(t => t.id === transactionId ? updatedTransaction : t)
      );
      onTransactionUpdate(updatedTransaction);
    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    setLoading(true);
    try {
      await apiClient.deleteTransaction(currentYear, currentMonth, transactionId);
      setLocalTransactions(prev => prev.filter(t => t.id !== transactionId));
    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.date || !newTransaction.description || !newTransaction.amount) {
      alert('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const addedTransaction = await apiClient.addTransaction(currentYear, currentMonth, {
        date: newTransaction.date,
        description: newTransaction.description,
        amount: parseFloat(newTransaction.amount),
        category: newTransaction.category
      });
      
      setLocalTransactions(prev => [...prev, addedTransaction]);
      setNewTransaction({ date: '', description: '', amount: '', category: 'Uncategorized' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMonth = async () => {
    setLoading(true);
    try {
      await apiClient.markMonthProcessed(currentYear, currentMonth);
      
      const isLastPdf = currentPdfIndex >= pdfQueue.length - 1;
      const monthName = getMonthName(currentMonth);
      
      if (isLastPdf) {
        alert(`${monthName} completed! All PDFs processed. Redirecting to summary...`);
      } else {
        const nextPdf = pdfQueue[currentPdfIndex + 1];
        const nextMonthName = getMonthName(nextPdf.selectedMonth);
        alert(`${monthName} completed! Moving to ${nextMonthName}...`);
      }
      
      onNextPdf();
    } catch (error: unknown) {
      console.error('Error marking month processed:', error);
      let errorMessage = 'Error marking month as processed';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
        }
      } else if (error && typeof error === 'object' && 'message' in error) {
        const errorWithMessage = error as { message: string };
        errorMessage = errorWithMessage.message;
      }
      
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    // Handle ISO date strings properly to avoid timezone issues
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Software': 'bg-blue-100 text-blue-800',
      'Meals 50%': 'bg-orange-100 text-orange-800',
      'Travel': 'bg-purple-100 text-purple-800',
      'Bank Fees': 'bg-red-100 text-red-800',
      'Supplies': 'bg-green-100 text-green-800',
      'Marketing': 'bg-pink-100 text-pink-800',
      'Professional Services': 'bg-indigo-100 text-indigo-800',
      'Uncategorized': 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getMonthName = (month: string) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[parseInt(month) - 1];
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {getMonthName(currentMonth)} {currentYear} - Transaction Review
            </h2>
            <p className="text-gray-600 mt-1">
              Review and categorize {localTransactions.length} transactions
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              PDF {currentPdfIndex + 1} of {pdfQueue.length} • Progress: {pdfQueue.filter(p => p.processed).length}/{pdfQueue.length} complete
            </div>
            
            {uploadedFile && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <FileText className="h-4 w-4" />
                <span>{uploadedFile.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-secondary flex items-center space-x-2"
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
            <span>Add Transaction</span>
          </button>

          <button
            onClick={handleCompleteMonth}
            className="btn-primary flex items-center space-x-2"
            disabled={loading || localTransactions.length === 0}
          >
            <ArrowRight className="h-4 w-4" />
            <span>
              {currentPdfIndex >= pdfQueue.length - 1 
                ? 'Complete & View Summary' 
                : `Complete ${getMonthName(currentMonth)} & Next PDF`
              }
            </span>
          </button>
        </div>
      </div>

      {/* Add Transaction Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Add New Transaction</h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={newTransaction.date}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
                className="input-field"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <input
                type="text"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                className="input-field"
                placeholder="Transaction description"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                className="input-field"
                placeholder="0.00"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={newTransaction.category}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, category: e.target.value }))}
                className="input-field"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleAddTransaction}
              className="btn-primary flex items-center space-x-2"
              disabled={loading}
            >
              <Save className="h-4 w-4" />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* PDF Viewer Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col p-0 h-[1150px]">
          <div className="flex items-center justify-between mb-4 p-6 pb-0">
            <h3 className="text-lg font-semibold text-gray-900">Bank Statement</h3>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden flex-1">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="PDF Preview"
              />
            ) : (
              <div className="h-full bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No PDF file loaded</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transactions Panel */}
        <div className="card flex flex-col h-[1150px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Extracted Transactions
            </h3>
            <span className="text-sm text-gray-500">
              {localTransactions.length} transactions
            </span>
          </div>
          
          <div className="space-y-3 flex-1 overflow-y-auto">
            {localTransactions
              .sort((a, b) => new Date(a.date + 'T00:00:00').getTime() - new Date(b.date + 'T00:00:00').getTime())
              .map((transaction) => (
              <div
                key={transaction.id}
                className={`border rounded-lg p-4 transition-colors ${
                  transaction.category === 'Uncategorized'
                    ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(transaction.date)}
                      </span>
                      <span className={`text-sm font-bold ${
                        transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatAmount(transaction.amount)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                      {transaction.description}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteTransaction(transaction.id)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                    disabled={loading}
                    title="Delete transaction"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Edit3 className="h-4 w-4 text-gray-400" />
                  <select
                    value={transaction.category}
                    onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                    disabled={loading}
                    className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(transaction.category)}`}>
                    {transaction.category}
                  </span>
                </div>
              </div>
            ))}
            
            {localTransactions.length === 0 && (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No transactions to display</p>
                <p className="text-sm text-gray-500 mt-1">
                  Upload a PDF to extract transactions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
