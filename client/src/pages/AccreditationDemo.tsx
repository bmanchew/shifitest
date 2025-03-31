import React from "react";
import AccreditationVerification from "../components/investor/AccreditationVerification";

const AccreditationDemo: React.FC = () => {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Investor Accreditation Verification</h1>
      <AccreditationVerification 
        onComplete={(method) => {
          console.log(`Verification completed for method: ${method}`);
          alert(`Verification completed for method: ${method}`);
        }}
        onCancel={() => {
          console.log("Verification cancelled");
          alert("Verification cancelled");
        }}
      />
    </div>
  );
};

export default AccreditationDemo;