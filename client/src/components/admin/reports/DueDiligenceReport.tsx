import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle, RefreshCw, FileText, FileSearch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DueDiligenceReportProps {
  merchantId: number;
  triggerRefresh?: () => void;
}

interface DueDiligenceReportData {
  id: number;
  merchantId: number;
  generatedAt: string;
  generatedBy: number;
  status: string;
  report?: string;
  summary?: string;
}

function DueDiligenceReport({ merchantId, triggerRefresh }: DueDiligenceReportProps) {
  const [reports, setReports] = useState<DueDiligenceReportData[]>([]);
  const [selectedReport, setSelectedReport] = useState<DueDiligenceReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullReport, setShowFullReport] = useState<boolean>(false);
  const { toast } = useToast();

  // Load all reports for this merchant
  useEffect(() => {
    fetchReports();
  }, [merchantId]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/admin/due-diligence/${merchantId}`);
      
      if (response.data.success) {
        setReports(response.data.reports);
        // If we have reports and none is selected, select the most recent one
        if (response.data.reports.length > 0 && !selectedReport) {
          // Sort by generatedAt in descending order
          const sortedReports = [...response.data.reports].sort(
            (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
          );
          // Load the full report for the most recent one
          fetchReportDetails(sortedReports[0].id);
        }
      } else {
        setError(response.data.error || 'Failed to fetch due diligence reports');
      }
    } catch (err) {
      setError('Error loading due diligence reports: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Fetch full report details
  const fetchReportDetails = async (reportId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/admin/due-diligence/report/${reportId}`);
      
      if (response.data.success && response.data.report) {
        setSelectedReport(response.data.report);
      } else {
        setError(response.data.error || 'Failed to fetch report details');
      }
    } catch (err) {
      setError('Error loading report details: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Generate a new due diligence report
  const generateReport = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      toast({
        title: "Generating Report",
        description: "Due diligence report generation started. This may take a minute...",
      });
      
      const response = await axios.post(`/api/admin/due-diligence/generate/${merchantId}`);
      
      if (response.data.success) {
        toast({
          title: "Report Generated",
          description: "Due diligence report has been generated successfully."
        });
        
        // Reload reports and select the new one
        await fetchReports();
        fetchReportDetails(response.data.reportId);
        
        // Trigger parent refresh if provided
        if (triggerRefresh) {
          triggerRefresh();
        }
      } else {
        setError(response.data.error || 'Failed to generate due diligence report');
        toast({
          title: "Generation Failed",
          description: response.data.error || 'Failed to generate due diligence report',
          variant: "destructive"
        });
      }
    } catch (err) {
      const errorMessage = 'Error generating due diligence report: ' + (err instanceof Error ? err.message : String(err));
      setError(errorMessage);
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  // Delete a report
  const deleteReport = async (reportId: number) => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const response = await axios.delete(`/api/admin/due-diligence/report/${reportId}`);
      
      if (response.data.success) {
        toast({
          title: "Report Deleted",
          description: "The due diligence report has been deleted."
        });
        
        // If the deleted report was selected, clear the selection
        if (selectedReport && selectedReport.id === reportId) {
          setSelectedReport(null);
        }
        
        // Reload the reports list
        fetchReports();
      } else {
        setError(response.data.error || 'Failed to delete report');
        toast({
          title: "Deletion Failed",
          description: response.data.error || 'Failed to delete report',
          variant: "destructive"
        });
      }
    } catch (err) {
      const errorMessage = 'Error deleting report: ' + (err instanceof Error ? err.message : String(err));
      setError(errorMessage);
      toast({
        title: "Deletion Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Format the report for display
  const formatReportContent = (report: string) => {
    // Check if the report is already in HTML format
    if (report.startsWith('<') && report.includes('<h1>') || report.includes('<h2>')) {
      return <div dangerouslySetInnerHTML={{ __html: report }} />;
    }
    
    // Convert markdown-style headings to HTML
    let formattedReport = report
      .replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold my-4">$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2 class="text-xl font-bold my-3">$1</h2>')
      .replace(/^### (.*?)$/gm, '<h3 class="text-lg font-bold my-2">$1</h3>')
      .replace(/^#### (.*?)$/gm, '<h4 class="text-base font-bold my-2">$1</h4>');
    
    // Handle lists
    formattedReport = formattedReport
      .replace(/^\s*[-*•]\s+(.*?)$/gm, '<li class="ml-4">$1</li>')
      .replace(/<\/li>\n<li/g, '</li><li'); // Fix adjacent list items
    
    // Wrap lists in <ul>
    formattedReport = formattedReport
      .replace(/(<li.*?>.*?<\/li>(?:\n|$))+/g, (match) => `<ul class="list-disc my-2 pl-5">${match}</ul>`);
    
    // Convert paragraphs (double newlines)
    formattedReport = formattedReport
      .replace(/(?<!\n<\/[uo]l>)\n\n(?!<[uo]l>)/g, '</p><p class="my-2">');
    
    // Wrap in paragraph tags if not already wrapped
    if (!formattedReport.startsWith('<p')) {
      formattedReport = `<p class="my-2">${formattedReport}</p>`;
    }
    
    // Replace single line breaks that aren't part of lists with <br/>
    formattedReport = formattedReport
      .replace(/(?<!\n<\/[uo]l>)\n(?!<[uo]l>)/g, '<br/>');
    
    return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formattedReport }} />;
  };

  // Risk score to color mapping
  const getRiskScoreColor = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('high')) return 'text-red-600 font-semibold';
    if (lowerText.includes('medium')) return 'text-yellow-600 font-semibold';
    if (lowerText.includes('low')) return 'text-green-600 font-semibold';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">Due Diligence Reports</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">AI-powered merchant risk assessment</p>
        </div>
        <div className="flex space-x-3">
          <Button 
            onClick={generateReport} 
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate New Report
              </>
            )}
          </Button>
          
          {reports.length > 0 && (
            <Button
              onClick={fetchReports}
              variant="outline"
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {loading && !generating && (
        <div className="px-4 py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-sm text-gray-500">Loading due diligence reports...</p>
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="px-4 py-8 text-center border-t border-gray-200">
          <FileSearch className="h-10 w-10 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500 mb-4">No due diligence reports found for this merchant.</p>
          <p className="text-sm text-gray-500">Generate a new report to assess merchant risk and compliance.</p>
        </div>
      )}

      {reports.length > 0 && (
        <div className="border-t border-gray-200">
          {/* Reports List */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-700">Available Reports</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr 
                    key={report.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${selectedReport?.id === report.id ? 'bg-blue-50' : ''}`}
                    onClick={() => fetchReportDetails(report.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{new Date(report.generatedAt).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{new Date(report.generatedAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        report.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchReportDetails(report.id);
                        }} 
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        View
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteReport(report.id);
                        }} 
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected Report */}
          {selectedReport && selectedReport.report && (
            <div className="px-4 py-5 border-t border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-gray-900">
                  Report from {new Date(selectedReport.generatedAt).toLocaleString()}
                </h4>
                <Button
                  variant="outline"
                  onClick={() => setShowFullReport(!showFullReport)}
                >
                  {showFullReport ? 'Show Summary' : 'Show Full Report'}
                </Button>
              </div>
              
              <div className="prose prose-sm max-w-none">
                {showFullReport ? (
                  // Show full report content
                  <div className="bg-white border border-gray-200 rounded-md p-4 prose prose-sm max-w-none overflow-auto max-h-[800px]">
                    {formatReportContent(selectedReport.report)}
                  </div>
                ) : (
                  // Show summary with key findings
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* Extract and display risk score */}
                      {selectedReport.report.match(/risk rating:?\s*([^.\n]*)/i) && (
                        <div className="bg-gray-50 rounded-md p-4">
                          <h5 className="text-sm font-semibold text-gray-700 mb-2">Overall Risk Rating</h5>
                          <p className={getRiskScoreColor(selectedReport.report.match(/risk rating:?\s*([^.\n]*)/i)![1])}>
                            {selectedReport.report.match(/risk rating:?\s*([^.\n]*)/i)![1].trim()}
                          </p>
                        </div>
                      )}
                      
                      {/* Extract and display recommendation */}
                      {selectedReport.report.match(/recommendation:?\s*([^.\n]*)/i) && (
                        <div className="bg-gray-50 rounded-md p-4">
                          <h5 className="text-sm font-semibold text-gray-700 mb-2">Recommendation</h5>
                          <p className="text-gray-900">
                            {selectedReport.report.match(/recommendation:?\s*([^.\n]*)/i)![1].trim()}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Display first 1000 characters as a preview */}
                    <div className="bg-white border border-gray-200 rounded-md p-4">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">Report Preview</h5>
                      {formatReportContent(selectedReport.report.substring(0, 1000) + '...')}
                      <p className="text-sm text-gray-500 mt-4">
                        <em>This is a preview. Click "Show Full Report" to view the complete analysis.</em>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DueDiligenceReport;