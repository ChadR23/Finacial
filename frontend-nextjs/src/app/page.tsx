'use client';

import { useState } from 'react';
import { Upload, FileText, BarChart3, Download } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import TransactionViewer from '@/components/TransactionViewer';
import Summary from '@/components/Summary';
import { Transaction, apiClient } from '@/lib/api';

interface PDFFile {
  file: File;
  detectedMonth: string;
  selectedMonth: string;
  processed: boolean;
  transactions?: Transaction[];
}

export default function Home() {
  const [currentView, setCurrentView] = useState<'upload' | 'workflow' | 'summary'>('upload');
  const [selectedYear, setSelectedYear] = useState<string>('2024');
  const [pdfQueue, setPdfQueue] = useState<PDFFile[]>([]);
  const [currentPdfIndex, setCurrentPdfIndex] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleBatchReady = (pdfFiles: PDFFile[], year: string) => {
    setPdfQueue(pdfFiles);
    setSelectedYear(year);
    setCurrentPdfIndex(0);
    // Start processing the first PDF
    processCurrentPdf(pdfFiles, 0);
  };

  const processCurrentPdf = async (pdfs: PDFFile[], index: number) => {
    if (index >= pdfs.length) {
      // All PDFs processed, go to summary
      setCurrentView('summary');
      return;
    }

    const currentPdf = pdfs[index];
    setUploadedFile(currentPdf.file);
    
    console.log(`Uploading PDF: ${currentPdf.file.name}, Year: ${selectedYear}, Month: ${currentPdf.selectedMonth}`);
    
    try {
      // Upload and process the current PDF
      const response = await apiClient.uploadFile(currentPdf.file, selectedYear, currentPdf.selectedMonth);
      setTransactions(response.transactions);
      setCurrentView('workflow');
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert(`Error processing ${currentPdf.file.name}. Please try again.`);
    }
  };

  const handleTransactionUpdate = (updatedTransaction: Transaction) => {
    setTransactions(prev => 
      prev.map(transaction => 
        transaction.id === updatedTransaction.id ? updatedTransaction : transaction
      )
    );
  };

  const handleNextPdf = () => {
    // Mark current PDF as processed
    const updatedQueue = [...pdfQueue];
    updatedQueue[currentPdfIndex].processed = true;
    updatedQueue[currentPdfIndex].transactions = transactions;
    setPdfQueue(updatedQueue);

    // Move to next PDF
    const nextIndex = currentPdfIndex + 1;
    setCurrentPdfIndex(nextIndex);
    processCurrentPdf(updatedQueue, nextIndex);
  };

  const getCurrentMonth = () => {
    if (pdfQueue.length > 0 && currentPdfIndex < pdfQueue.length) {
      return pdfQueue[currentPdfIndex].selectedMonth;
    }
    return '';
  };

  const navigationItems = [
    {
      id: 'upload' as const,
      label: 'Upload PDFs',
      icon: Upload,
      description: 'Upload monthly bank statements'
    },
    {
      id: 'workflow' as const,
      label: 'Process Transactions',
      icon: FileText,
      description: 'Review and categorize monthly transactions',
      disabled: pdfQueue.length === 0
    },
    {
      id: 'summary' as const,
      label: 'Summary & Export',
      icon: BarChart3,
      description: 'View annual reports and export',
      disabled: !selectedYear
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">
                  Personal Expense Tracker
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {pdfQueue.length > 0 && (
                <span className="text-sm text-gray-500">
                  Processing PDF {currentPdfIndex + 1} of {pdfQueue.length} • {transactions.length} transactions
                </span>
              )}
              {pdfQueue.length === 0 && (
                <span className="text-sm text-gray-500">
                  Ready to upload PDFs
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setCurrentView(item.id)}
                  disabled={item.disabled}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                    ${isActive 
                      ? 'border-blue-500 text-blue-600' 
                      : item.disabled 
                        ? 'border-transparent text-gray-400 cursor-not-allowed'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className={`${currentView === 'workflow' ? 'px-0 py-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        {currentView === 'upload' && (
          <FileUpload onBatchReady={handleBatchReady} />
        )}
        
        {currentView === 'workflow' && getCurrentMonth() && (
          <TransactionViewer 
            transactions={transactions}
            uploadedFile={uploadedFile}
            currentYear={selectedYear}
            currentMonth={getCurrentMonth()}
            pdfQueue={pdfQueue}
            currentPdfIndex={currentPdfIndex}
            onTransactionUpdate={handleTransactionUpdate}
            onNextPdf={handleNextPdf}
          />
        )}
        
        {currentView === 'summary' && (
          <Summary transactions={transactions} selectedYear={selectedYear} />
        )}
      </main>
    </div>
  );
}