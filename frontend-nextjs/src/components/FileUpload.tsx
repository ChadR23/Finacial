'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { apiClient, UploadResponse, Transaction } from '@/lib/api';

interface PDFFile {
  file: File;
  detectedMonth: string;
  selectedMonth: string;
  processed: boolean;
  transactions?: Transaction[];
}

interface FileUploadProps {
  onBatchReady: (pdfFiles: PDFFile[], year: string) => void;
}

export default function FileUpload({ onBatchReady }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('2024');
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate year options (current year and past 3 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, i) => (currentYear - i).toString());
  
  console.log('Year options generated:', yearOptions);
  console.log('Selected year:', selectedYear);
  console.log('Frontend version: 2024-fix-v1.0');

  // Month options
  const monthOptions = [
    { value: '', label: 'Select a month...' },
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  // Auto-detect month from filename
  const detectMonthFromFilename = (filename: string): string => {
    const normalizedName = filename.toLowerCase();
    const monthMap: Record<string, string> = {
      'jan': '01', 'january': '01',
      'feb': '02', 'february': '02',
      'mar': '03', 'march': '03',
      'apr': '04', 'april': '04',
      'may': '05',
      'jun': '06', 'june': '06',
      'jul': '07', 'july': '07',
      'aug': '08', 'august': '08',
      'sep': '09', 'sept': '09', 'september': '09',
      'oct': '10', 'october': '10',
      'nov': '11', 'november': '11',
      'dec': '12', 'december': '12'
    };

    for (const [monthName, monthValue] of Object.entries(monthMap)) {
      if (normalizedName.includes(monthName)) {
        return monthValue;
      }
    }

    // Try to detect numeric months (01, 02, etc.)
    const numericMatch = normalizedName.match(/\b(0[1-9]|1[0-2])\b/);
    if (numericMatch) {
      return numericMatch[1];
    }

    return ''; // No month detected
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    setError(null);
    setSuccess(null);

    const pdfFiles = files.filter(file => file.type.includes('pdf'));
    
    if (pdfFiles.length === 0) {
      setError('Please upload PDF files only.');
      return;
    }

    const newPdfFiles: PDFFile[] = pdfFiles.map(file => {
      const detectedMonth = detectMonthFromFilename(file.name);
      return {
        file,
        detectedMonth,
        selectedMonth: detectedMonth,
        processed: false
      };
    });

    setPdfFiles(prev => [...prev, ...newPdfFiles]);
    setSuccess(`Added ${pdfFiles.length} PDF file(s) to the batch. ${newPdfFiles.filter(p => p.detectedMonth).length} month(s) auto-detected.`);
  };

  const updatePdfMonth = (index: number, month: string) => {
    setPdfFiles(prev => prev.map((pdf, i) => 
      i === index ? { ...pdf, selectedMonth: month } : pdf
    ));
  };

  const removePdf = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startBatchProcessing = () => {
    const unassignedPdfs = pdfFiles.filter(pdf => !pdf.selectedMonth);
    
    if (unassignedPdfs.length > 0) {
      setError(`Please select months for all PDFs. ${unassignedPdfs.length} PDF(s) need month assignment.`);
      return;
    }

    if (pdfFiles.length === 0) {
      setError('Please add some PDF files first.');
      return;
    }

    console.log(`Starting batch processing with year: ${selectedYear}`);
    console.log(`PDF files:`, pdfFiles.map(pdf => ({ name: pdf.file.name, month: pdf.selectedMonth })));

    // Sort PDFs by month order
    const sortedPdfs = [...pdfFiles].sort((a, b) => 
      parseInt(a.selectedMonth) - parseInt(b.selectedMonth)
    );

    onBatchReady(sortedPdfs, selectedYear);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <Upload className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Upload Bank Statements (Batch)
          </h2>
          <p className="text-gray-600">
            Upload multiple PDF bank statements and assign months to process them in order
          </p>
        </div>

        {/* Year Selection */}
        <div className="mb-6">
          <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
            Year for all statements
          </label>
          <select
            id="year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="input-field w-full md:w-48"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        
        <div
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-200
            ${dragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
            ${isUploading ? 'pointer-events-none opacity-50' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <div className="space-y-4">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            
            <div>
              <p className="text-lg font-medium text-gray-900">
                {dragActive ? 'Drop your PDF files here' : 'Click here or drag and drop multiple PDF files'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                PDF files only, up to 16MB each. Upload multiple files at once.
              </p>
            </div>
            
            <button 
              className="btn-primary"
              disabled={isUploading}
              onClick={(e) => {
                e.stopPropagation();
                openFileDialog();
              }}
            >
              {isUploading ? 'Processing...' : 'Choose Files'}
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Status Messages */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <p className="text-sm text-green-700 mt-1">{success}</p>
            </div>
          </div>
        )}

        {/* PDF Files List */}
        {pdfFiles.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Uploaded PDFs ({pdfFiles.length})
              </h3>
              <button
                onClick={startBatchProcessing}
                className="btn-primary"
                disabled={pdfFiles.some(pdf => !pdf.selectedMonth)}
              >
                Start Processing ({pdfFiles.filter(pdf => pdf.selectedMonth).length}/{pdfFiles.length} ready)
              </button>
            </div>
            
            <div className="space-y-3">
              {pdfFiles.map((pdfFile, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {pdfFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(pdfFile.file.size / 1024 / 1024).toFixed(2)} MB
                      {pdfFile.detectedMonth && (
                        <span className="ml-2 text-green-600">
                          • Auto-detected: {monthOptions.find(m => m.value === pdfFile.detectedMonth)?.label}
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <select
                      value={pdfFile.selectedMonth}
                      onChange={(e) => updatePdfMonth(index, e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {monthOptions.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => removePdf(index)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Remove PDF"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">How it works:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Upload multiple PDF bank statements at once</li>
            <li>• Months are auto-detected from filenames when possible</li>
            <li>• Assign months manually for any undetected files</li>
            <li>• Process PDFs in chronological order (January → December)</li>
            <li>• Review and complete each month before moving to the next</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
