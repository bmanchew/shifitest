import React from 'react';

export default function TestPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="text-center p-8 rounded-lg shadow-lg bg-card">
        <h1 className="text-3xl font-bold text-primary mb-4">Test Page Working!</h1>
        <p className="text-lg text-muted-foreground">The routing is functioning correctly if you can see this page.</p>
        <p className="mt-4 text-sm text-muted-foreground">Path: /test-page</p>
      </div>
    </div>
  );
}