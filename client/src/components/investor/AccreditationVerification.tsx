import { useState } from 'react';

import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { UploadDropzone } from '../ui/upload/upload-dropzone';
import { AlertCircle, Check, FileText, DollarSign, Building, BadgeCheck, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export interface AccreditationVerificationProps {
  investorId?: number;
  onVerificationSubmit?: (method: string, data: any) => Promise<void>;
  onDocumentUpload?: (files: File[], type: string, method: string) => Promise<void>;
}

export function AccreditationVerification({ 
  investorId,
  onVerificationSubmit = async () => {},
  onDocumentUpload = async () => {}
}: AccreditationVerificationProps) {
  const [activeTab, setActiveTab] = useState('income');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Form state
  const [incomeData, setIncomeData] = useState({
    income: '',
    jointIncome: false,
    currentYearEstimate: '',
    method: 'tax_returns'
  });
  
  const [netWorthData, setNetWorthData] = useState({
    totalAssets: '',
    totalLiabilities: '',
    primaryResidenceValue: '',
    primaryResidenceMortgage: '',
    method: 'bank_statements'
  });
  
  const [professionalData, setProfessionalData] = useState({
    certType: '',
    licenseNumber: '',
    otherCertDescription: '',
    issueDate: '',
    expirationDate: ''
  });
  
  const [thirdPartyData, setThirdPartyData] = useState({
    verifierName: '',
    verifierCompany: '',
    verifierEmail: '',
    verifierPhone: '',
    relationship: ''
  });
  
  // Handle file uploads for different methods
  const handleFileUpload = async (files: File[], documentType: string) => {
    if (files.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 300);
    
    try {
      await onDocumentUpload(files, documentType, activeTab);
      setUploadProgress(100);
      
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (error) {
      setErrorMessage('File upload failed. Please try again.');
      setUploadProgress(0);
      setUploading(false);
      clearInterval(progressInterval);
    }
  };
  
  // Handle form submissions for different methods
  const handleSubmit = async (method: string) => {
    setVerificationStatus('submitting');
    setErrorMessage('');
    
    try {
      let data;
      
      switch (method) {
        case 'income':
          data = {
            ...incomeData,
            income: Number(incomeData.income),
            currentYearEstimate: Number(incomeData.currentYearEstimate)
          };
          break;
          
        case 'net_worth':
          data = {
            ...netWorthData,
            totalAssets: Number(netWorthData.totalAssets),
            totalLiabilities: Number(netWorthData.totalLiabilities),
            primaryResidenceValue: netWorthData.primaryResidenceValue ? Number(netWorthData.primaryResidenceValue) : null,
            primaryResidenceMortgage: netWorthData.primaryResidenceMortgage ? Number(netWorthData.primaryResidenceMortgage) : null
          };
          break;
          
        case 'professional':
          data = professionalData;
          break;
          
        case 'third_party':
          data = thirdPartyData;
          break;
          
        default:
          throw new Error('Invalid verification method');
      }
      
      await onVerificationSubmit(method, data);
      setVerificationStatus('success');
      
      // Reset after success
      setTimeout(() => {
        setVerificationStatus('idle');
      }, 3000);
    } catch (error) {
      setVerificationStatus('error');
      setErrorMessage('Submission failed. Please check your information and try again.');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Investor Accreditation Verification</h2>
      <p className="text-gray-500 mb-6">
        Please select a verification method and provide the required documentation to verify your accredited investor status.
      </p>
      
      <Tabs defaultValue="income" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="income" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span>Income</span>
          </TabsTrigger>
          <TabsTrigger value="net_worth" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span>Net Worth</span>
          </TabsTrigger>
          <TabsTrigger value="professional" className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" />
            <span>Professional</span>
          </TabsTrigger>
          <TabsTrigger value="third_party" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Third Party</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Income-Based Verification */}
        <TabsContent value="income">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Income-Based Verification</h3>
            <p className="text-gray-500 mb-6">
              To qualify as an accredited investor based on income, you must have earned income that exceeded $200,000 (or $300,000 together with a spouse) in each of the prior two years, and reasonably expect the same for the current year.
            </p>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="income">Annual Income (Past 2 Years Average)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input 
                      id="income" 
                      type="text" 
                      placeholder="0.00" 
                      className="pl-8"
                      value={incomeData.income}
                      onChange={(e) => setIncomeData({...incomeData, income: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="jointIncome"
                    checked={incomeData.jointIncome}
                    onCheckedChange={(checked) => 
                      setIncomeData({...incomeData, jointIncome: checked as boolean})
                    }
                  />
                  <Label htmlFor="jointIncome">Joint income with spouse</Label>
                </div>
                
                <div>
                  <Label htmlFor="currentYearEstimate">Current Year Income Estimate</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input 
                      id="currentYearEstimate" 
                      type="text" 
                      placeholder="0.00" 
                      className="pl-8"
                      value={incomeData.currentYearEstimate}
                      onChange={(e) => setIncomeData({...incomeData, currentYearEstimate: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="income-verification-method" className="mb-1 block">Verification Method</Label>
                  <Select
                    value={incomeData.method}
                    onValueChange={(value) => setIncomeData({...incomeData, method: value})}
                  >
                    <SelectTrigger id="income-verification-method" className="w-full">
                      <SelectValue placeholder="Select a verification method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tax_returns">Tax Returns</SelectItem>
                      <SelectItem value="w2_forms">W-2 Forms</SelectItem>
                      <SelectItem value="pay_stubs">Pay Stubs</SelectItem>
                      <SelectItem value="employer_letter">Employer Verification Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-medium mb-2">Upload Supporting Documents</h4>
                <UploadDropzone
                  multiple={true}
                  maxFiles={5}
                  onUpload={(files: File[]) => handleFileUpload(files, 'income_verification')}
                  uploading={uploading}
                  progress={uploadProgress}
                  description="Upload tax returns, W-2s, or pay stubs (PDF, JPG)"
                  acceptedFileTypes=".pdf,.jpg,.jpeg,.png"
                />
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={() => handleSubmit('income')} 
                  disabled={!incomeData.income || !incomeData.currentYearEstimate || verificationStatus === 'submitting'}
                  className="px-6"
                >
                  {verificationStatus === 'submitting' ? 'Submitting...' : 'Submit for Verification'}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
        
        {/* Net Worth Verification */}
        <TabsContent value="net_worth">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Net Worth Verification</h3>
            <p className="text-gray-500 mb-6">
              To qualify as an accredited investor based on net worth, you must have a net worth exceeding $1 million, either individually or jointly with your spouse (excluding the value of your primary residence).
            </p>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="totalAssets">Total Assets</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input 
                      id="totalAssets" 
                      type="text" 
                      placeholder="0.00" 
                      className="pl-8"
                      value={netWorthData.totalAssets}
                      onChange={(e) => setNetWorthData({...netWorthData, totalAssets: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="totalLiabilities">Total Liabilities</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input 
                      id="totalLiabilities" 
                      type="text" 
                      placeholder="0.00" 
                      className="pl-8"
                      value={netWorthData.totalLiabilities}
                      onChange={(e) => setNetWorthData({...netWorthData, totalLiabilities: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="primaryResidenceValue">Primary Residence Value (optional)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input 
                      id="primaryResidenceValue" 
                      type="text" 
                      placeholder="0.00" 
                      className="pl-8"
                      value={netWorthData.primaryResidenceValue}
                      onChange={(e) => setNetWorthData({...netWorthData, primaryResidenceValue: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="primaryResidenceMortgage">Primary Residence Mortgage (optional)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input 
                      id="primaryResidenceMortgage" 
                      type="text" 
                      placeholder="0.00" 
                      className="pl-8"
                      value={netWorthData.primaryResidenceMortgage}
                      onChange={(e) => setNetWorthData({...netWorthData, primaryResidenceMortgage: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="networth-verification-method" className="mb-1 block">Verification Method</Label>
                  <Select
                    value={netWorthData.method}
                    onValueChange={(value) => setNetWorthData({...netWorthData, method: value})}
                  >
                    <SelectTrigger id="networth-verification-method" className="w-full">
                      <SelectValue placeholder="Select a verification method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_statements">Bank Statements</SelectItem>
                      <SelectItem value="brokerage_statements">Brokerage Statements</SelectItem>
                      <SelectItem value="tax_assessment">Tax Assessment Documents</SelectItem>
                      <SelectItem value="cpa_letter">CPA Verification Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-medium mb-2">Upload Supporting Documents</h4>
                <UploadDropzone
                  multiple={true}
                  maxFiles={5}
                  onUpload={(files: File[]) => handleFileUpload(files, 'net_worth_verification')}
                  uploading={uploading}
                  progress={uploadProgress}
                  description="Upload bank/brokerage statements, etc. (PDF, JPG)"
                  acceptedFileTypes=".pdf,.jpg,.jpeg,.png"
                />
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={() => handleSubmit('net_worth')} 
                  disabled={!netWorthData.totalAssets || !netWorthData.totalLiabilities || verificationStatus === 'submitting'}
                  className="px-6"
                >
                  {verificationStatus === 'submitting' ? 'Submitting...' : 'Submit for Verification'}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
        
        {/* Professional Certification */}
        <TabsContent value="professional">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Professional Certification</h3>
            <p className="text-gray-500 mb-6">
              Certain professional certifications, designations, or credentials can qualify you as an accredited investor. This includes Series 7, Series 65, and Series 82 licenses, as well as other qualifying credentials.
            </p>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="certType" className="mb-1 block">Certification Type</Label>
                  <Select
                    value={professionalData.certType}
                    onValueChange={(value) => setProfessionalData({...professionalData, certType: value})}
                  >
                    <SelectTrigger id="certType" className="w-full">
                      <SelectValue placeholder="Select a certification type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="series_7">Series 7 License</SelectItem>
                      <SelectItem value="series_65">Series 65 License</SelectItem>
                      <SelectItem value="series_82">Series 82 License</SelectItem>
                      <SelectItem value="cfa">CFA Charter</SelectItem>
                      <SelectItem value="cpa">CPA License</SelectItem>
                      <SelectItem value="other">Other Professional Certification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {professionalData.certType === 'other' && (
                  <div>
                    <Label htmlFor="otherCertDescription">Describe Your Certification</Label>
                    <Input 
                      id="otherCertDescription" 
                      type="text" 
                      placeholder="e.g., Investment Advisor Certification"
                      value={professionalData.otherCertDescription}
                      onChange={(e) => setProfessionalData({...professionalData, otherCertDescription: e.target.value})}
                    />
                  </div>
                )}
                
                <div>
                  <Label htmlFor="licenseNumber">License/Certification Number</Label>
                  <Input 
                    id="licenseNumber" 
                    type="text" 
                    placeholder="License or certification number" 
                    value={professionalData.licenseNumber}
                    onChange={(e) => setProfessionalData({...professionalData, licenseNumber: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input 
                    id="issueDate" 
                    type="date"
                    value={professionalData.issueDate}
                    onChange={(e) => setProfessionalData({...professionalData, issueDate: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="expirationDate">Expiration Date (if applicable)</Label>
                  <Input 
                    id="expirationDate" 
                    type="date"
                    value={professionalData.expirationDate}
                    onChange={(e) => setProfessionalData({...professionalData, expirationDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-medium mb-2">Upload Supporting Documents</h4>
                <UploadDropzone
                  multiple={true}
                  maxFiles={3}
                  onUpload={(files: File[]) => handleFileUpload(files, 'professional_certification')}
                  uploading={uploading}
                  progress={uploadProgress}
                  description="Upload certification or license documentation (PDF, JPG)"
                  acceptedFileTypes=".pdf,.jpg,.jpeg,.png"
                />
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={() => handleSubmit('professional')} 
                  disabled={!professionalData.certType || !professionalData.licenseNumber || verificationStatus === 'submitting'}
                  className="px-6"
                >
                  {verificationStatus === 'submitting' ? 'Submitting...' : 'Submit for Verification'}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
        
        {/* Third-Party Verification */}
        <TabsContent value="third_party">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Third-Party Verification</h3>
            <p className="text-gray-500 mb-6">
              Provide contact information for a third party (such as an attorney, CPA, or financial advisor) who can verify your accredited investor status.
            </p>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="verifierName">Verifier's Name</Label>
                  <Input 
                    id="verifierName" 
                    type="text" 
                    placeholder="Full name" 
                    value={thirdPartyData.verifierName}
                    onChange={(e) => setThirdPartyData({...thirdPartyData, verifierName: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="verifierCompany">Verifier's Company/Firm</Label>
                  <Input 
                    id="verifierCompany" 
                    type="text" 
                    placeholder="Company or firm name" 
                    value={thirdPartyData.verifierCompany}
                    onChange={(e) => setThirdPartyData({...thirdPartyData, verifierCompany: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="relationship">Relationship to Verifier</Label>
                  <Select
                    value={thirdPartyData.relationship}
                    onValueChange={(value) => setThirdPartyData({...thirdPartyData, relationship: value})}
                  >
                    <SelectTrigger id="relationship" className="w-full">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="attorney">Attorney</SelectItem>
                      <SelectItem value="cpa">Certified Public Accountant (CPA)</SelectItem>
                      <SelectItem value="financial_advisor">Financial Advisor</SelectItem>
                      <SelectItem value="investment_advisor">Investment Advisor</SelectItem>
                      <SelectItem value="broker_dealer">Broker-Dealer</SelectItem>
                      <SelectItem value="other">Other Professional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="verifierEmail">Verifier's Email</Label>
                  <Input 
                    id="verifierEmail" 
                    type="email" 
                    placeholder="Email address" 
                    value={thirdPartyData.verifierEmail}
                    onChange={(e) => setThirdPartyData({...thirdPartyData, verifierEmail: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="verifierPhone">Verifier's Phone Number</Label>
                  <Input 
                    id="verifierPhone" 
                    type="tel" 
                    placeholder="Phone number" 
                    value={thirdPartyData.verifierPhone}
                    onChange={(e) => setThirdPartyData({...thirdPartyData, verifierPhone: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-medium mb-2">Upload Authorization Letter (Optional)</h4>
                <p className="text-sm text-gray-500 mb-2">
                  Upload a signed authorization letter allowing us to contact your third-party verifier.
                </p>
                <UploadDropzone
                  multiple={false}
                  maxFiles={1}
                  onUpload={(files: File[]) => handleFileUpload(files, 'third_party_authorization')}
                  uploading={uploading}
                  progress={uploadProgress}
                  description="Upload authorization letter (PDF preferred)"
                  acceptedFileTypes=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={() => handleSubmit('third_party')} 
                  disabled={!thirdPartyData.verifierName || !thirdPartyData.verifierEmail || !thirdPartyData.relationship || verificationStatus === 'submitting'}
                  className="px-6"
                >
                  {verificationStatus === 'submitting' ? 'Submitting...' : 'Submit for Verification'}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Status messages */}
      {verificationStatus === 'success' && (
        <Alert className="mt-6 bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-500" />
          <AlertTitle>Information Submitted</AlertTitle>
          <AlertDescription>
            Your accreditation information has been submitted. Our team will review it shortly.
          </AlertDescription>
        </Alert>
      )}
      
      {verificationStatus === 'error' && (
        <Alert className="mt-6 bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {errorMessage || 'An error occurred while submitting your information. Please try again.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}