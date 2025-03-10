try {
        setIsSubmitting(true);

        // Send the application via SMS
        const response = await apiRequest('POST', '/api/send-application', {
          phoneNumber: formattedPhone,
          customerName: formData.customerName,
          amount,
          term
        });

        console.log("SMS API Response:", response);

        // Check if we have a contract ID in the response
        if (response.contractId) {
          toast({
            title: "Success",
            description: `Application sent to ${formattedPhone}`,
          });

          // Navigate to the contract details page
          navigate(`/admin/contracts/${response.contractId}`);
        } else if (response.success) {
          // If success but no contractId, just show success without navigation
          toast({
            title: "Success",
            description: `Application sent to ${formattedPhone}`,
          });

          // Reset form after successful submission
          resetForm();
        } else {
          console.error("Contract ID is invalid or missing from API response:", response);
          toast({
            title: "Error",
            description: "Something went wrong. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error sending application:", error);
        toast({
          title: "Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    };