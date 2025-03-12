// ... (rest of the file, assumed to contain the function where this code snippet resides) ...

function getCFPBData(params) {
  // ... (other code) ...

      params.append('field', 'state');
      params.append('field', 'complaint_what_happened');
      params.append('field', 'company_response');
      params.append('field', 'consumer_consented'); // Added to ensure consent data is included
      params.append('field', 'consumer_disputed'); // Added to ensure dispute data is included
      params.append('field', 'consumer_complaint_narrative'); // Added to get consumer narrative
      params.append('field', 'tags'); // Get any tags that might identify the consumer

      logger.info({
  // ... (rest of the function) ...
}


// ... (rest of the file) ...