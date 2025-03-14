import React, { useState, useEffect } from "react";

/**
 * KYC Verification Component
 * Handles both states of KYC verification:
 * 1. Not yet verified - Shows verification button
 * 2. Already verified - Shows verified status
 */
const KYCVerification = ({
  contractId,
  phoneNumber,
  onVerificationComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState({
    alreadyVerified: false,
    verificationInProgress: false,
    kycData: null,
    error: null,
  });

  // Function to check KYC status
  const checkKycStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/kyc/check-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contractId, phoneNumber }),
      });

      const data = await response.json();

      if (data.success) {
        // If KYC is already verified, get the KYC progress data
        if (data.alreadyVerified) {
          await getKycProgress();
        }

        setKycStatus((prevState) => ({
          ...prevState,
          alreadyVerified: data.alreadyVerified,
          error: null,
        }));
      } else {
        throw new Error(data.message || "Failed to check KYC status");
      }
    } catch (error) {
      console.error("Error checking KYC status:", error);
      setKycStatus((prevState) => ({
        ...prevState,
        error: error.message,
      }));
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch KYC progress data
  const getKycProgress = async () => {
    try {
      const response = await fetch(
        `/api/application-progress/kyc/${contractId}`,
      );
      if (response.ok) {
        const kycData = await response.json();
        setKycStatus((prevState) => ({
          ...prevState,
          kycData,
          // Only consider verification complete if kycData shows completed = true
          alreadyVerified: kycData.completed === true,
        }));

        // If KYC is completed, notify parent component
        if (kycData.completed && onVerificationComplete) {
          onVerificationComplete(kycData);
        }
      }
    } catch (error) {
      console.error("Error fetching KYC progress:", error);
    }
  };

  // Function to start verification process
  const startVerification = async () => {
    try {
      setKycStatus((prevState) => ({
        ...prevState,
        verificationInProgress: true,
        error: null,
      }));

      const response = await fetch("/api/kyc/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contractId, phoneNumber }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.alreadyVerified) {
          // If already verified from another contract, just update our status
          await forceCompleteVerification();
        } else if (data.session?.session_url) {
          // Open verification in a new window
          const verificationWindow = window.open(
            data.session.session_url,
            "_blank",
            "width=600,height=800",
          );

          // Handle window closing or verification completing
          const checkWindowClosed = setInterval(async () => {
            if (!verificationWindow || verificationWindow.closed) {
              clearInterval(checkWindowClosed);

              // After window closes, wait briefly then check status again
              setTimeout(async () => {
                await checkKycStatus();
                await getKycProgress();

                setKycStatus((prevState) => ({
                  ...prevState,
                  verificationInProgress: false,
                }));
              }, 2000);
            }
          }, 1000);
        }
      } else {
        throw new Error(
          data.message || "Failed to create verification session",
        );
      }
    } catch (error) {
      console.error("Error starting verification:", error);
      setKycStatus((prevState) => ({
        ...prevState,
        verificationInProgress: false,
        error: error.message,
      }));
    }
  };

  // Function to manually force completion of verification (for debugging or admin use)
  const forceCompleteVerification = async () => {
    try {
      const response = await fetch(
        `/api/application-progress/kyc/${contractId}`,
      );
      if (response.ok) {
        const kycData = await response.json();

        // Mark KYC as completed
        const updateResponse = await fetch(
          `/api/application-progress/${kycData.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              completed: true,
              data: JSON.stringify({
                verified: true,
                verifiedAt: new Date().toISOString(),
                forcedCompletion: true,
              }),
            }),
          },
        );

        if (updateResponse.ok) {
          const updatedKycData = await updateResponse.json();
          setKycStatus((prevState) => ({
            ...prevState,
            alreadyVerified: true,
            kycData: updatedKycData,
            verificationInProgress: false,
          }));

          // Update contract step to next step
          await fetch(`/api/contracts/${contractId}/step`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              step: "bank",
            }),
          });

          // Notify parent component
          if (onVerificationComplete) {
            onVerificationComplete(updatedKycData);
          }
        }
      }
    } catch (error) {
      console.error("Error forcing verification completion:", error);
    }
  };

  // Check KYC status on component mount
  useEffect(() => {
    checkKycStatus();
    getKycProgress();

    // Set up polling to check status periodically (every 5 seconds)
    const statusPoll = setInterval(() => {
      if (!kycStatus.alreadyVerified && !kycStatus.verificationInProgress) {
        getKycProgress();
      }
    }, 5000);

    return () => clearInterval(statusPoll);
  }, [contractId]);

  // Render differently based on verification status
  if (loading) {
    return (
      <div className="kyc-verification loading">
        <p>Checking verification status...</p>
      </div>
    );
  }

  if (kycStatus.alreadyVerified) {
    return (
      <div className="kyc-verification verified">
        <div className="success-icon">✓</div>
        <h3>Identity Verified</h3>
        <p>Your identity has been successfully verified.</p>
        {onVerificationComplete && (
          <button
            onClick={() => onVerificationComplete(kycStatus.kycData)}
            className="btn btn-primary"
          >
            Continue to Next Step
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="kyc-verification">
      <h3>Identity Verification Required</h3>
      <p>We need to verify your identity to proceed with your application.</p>

      {kycStatus.error && (
        <div className="error-message">
          <p>Error: {kycStatus.error}</p>
        </div>
      )}

      <button
        onClick={startVerification}
        disabled={kycStatus.verificationInProgress}
        className="btn btn-primary"
      >
        {kycStatus.verificationInProgress
          ? "Verification in Progress..."
          : "Start Verification"}
      </button>
    </div>
  );
};

export default KYCVerification;
