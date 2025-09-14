'use client';

import { useState, useEffect } from 'react';
import { Download, TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { apiClient, SummaryData, Transaction } from '@/lib/api';

interface SummaryProps {
  transactions: Transaction[];
  selectedYear: string;
}

export default function Summary({ transactions, selectedYear }: SummaryProps) {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (selectedYear) {
      fetchSummary();
    }
  }, [selectedYear]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getSummary(selectedYear);
      setSummaryData(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const blob = await apiClient.exportPDF(selectedYear);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `expense-summary-${selectedYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      console.error('Error exporting PDF:', error);
      let errorMessage = 'Error generating PDF report. Please try again.';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error;
        }
      } else if (error && typeof error === 'object' && 'message' in error) {
        const errorWithMessage = error as { message: string };
        errorMessage = errorWithMessage.message;
      }
      
      alert(`PDF Export Error: ${errorMessage}`);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Prepare data for charts
  const prepareChartData = () => {
    if (!summaryData || !summaryData.category_totals) return [];
    
    return Object.entries(summaryData.category_totals)
      .filter(([category, amount]) => amount > 0)
      .map(([category, amount]) => ({
        name: category,
        value: amount
      }))
      .sort((a, b) => b.value - a.value);
  };

  const chartData = prepareChartData();

  // Colors for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading summary data...</p>
        </div>
      </div>
    );
  }

  if (!summaryData) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No data available</p>
        <p className="text-sm text-gray-500 mt-1">Upload transactions to see summary</p>
      </div>
    );
  }

  const netIncome = summaryData.total_income - summaryData.total_expenses;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{selectedYear} Annual Summary</h2>
          <p className="text-gray-600 mt-1">
            Complete financial overview and expense breakdown for {selectedYear}
          </p>
          {summaryData?.monthly_totals && (
            <p className="text-sm text-gray-500 mt-1">
              Data from {Object.keys(summaryData.monthly_totals).length} processed months
            </p>
          )}
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="btn-primary flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>{exporting ? 'Generating...' : 'Export PDF'}</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summaryData.total_income)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summaryData.total_expenses)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <DollarSign className={`h-5 w-5 ${
                  netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Net Income</p>
              <p className={`text-2xl font-bold ${
                netIncome >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(netIncome)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-2xl font-bold text-gray-900">
                {summaryData.transaction_count}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Chart */}
      {summaryData?.monthly_totals && Object.keys(summaryData.monthly_totals).length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(summaryData.monthly_totals).map(([month, data]) => ({
                month: new Date(parseInt(selectedYear), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short' }),
                income: data.income,
                expenses: data.expenses,
                net: data.net
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="income" fill="#10B981" name="Income" />
                <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                <Bar dataKey="net" fill="#3B82F6" name="Net" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Distribution</h3>
          {chartData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500">No expense data to display</p>
            </div>
          )}
        </div>

        {/* Category Breakdown Table */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Categories</h3>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(summaryData.category_totals)
                  .filter(([category, amount]) => amount > 0)
                  .sort(([,a], [,b]) => b - a)
                  .map(([category, amount]) => {
                    const percentage = ((amount / summaryData.total_expenses) * 100).toFixed(1);
                    return (
                      <tr key={category} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {category}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatCurrency(amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {percentage}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export Information */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Download className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">PDF Export</h3>
            <p className="text-sm text-blue-700 mt-1">
              Generate a professional PDF report for your tax preparer with all expense categories and totals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
