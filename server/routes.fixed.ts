// This is a temporary file for the fixed routes.ts

// Replace all instances of:
// .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
// With:
// .sort((a, b) => sortByDateDesc(a, b))

// And replace line 6320:
// .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
// With:
// .sort((a, b) => sortByDateDesc(a, b))[0];