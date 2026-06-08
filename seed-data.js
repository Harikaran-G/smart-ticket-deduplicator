export const sampleTickets = [
  // --- Cluster 1: Login issues (3 duplicates) ---
  {
    title: "Login button not responding on homepage",
    description: "When I click the login button on the main page, nothing happens. I've tried refreshing the browser and clearing cookies but the button still doesn't work. Using Chrome on Windows 11.",
    category: "Bug",
    priority: "High"
  },
  {
    title: "Can't sign in to my account",
    description: "The sign-in button on the landing page is completely unresponsive. I click it and nothing occurs — no loading spinner, no redirect, nothing. Tested on Chrome and Firefox.",
    category: "Bug",
    priority: "Critical"
  },
  {
    title: "Login page broken - button click does nothing",
    description: "Attempting to log in but the login button is non-functional. Clicking produces zero response. Multiple users in our office are experiencing this. Seems like a JavaScript error.",
    category: "Bug",
    priority: "High"
  },

  // --- Cluster 2: Dark mode request (2 duplicates) ---
  {
    title: "Please add dark mode to the dashboard",
    description: "The bright white dashboard is straining my eyes during late night work sessions. Would love a dark mode toggle in the settings panel. Many modern apps support this.",
    category: "Feature Request",
    priority: "Medium"
  },
  {
    title: "Feature request: Night theme / dark UI option",
    description: "It would be great to have a dark theme option. Working at night with the current white interface is uncomfortable. A toggle in user preferences would be ideal.",
    category: "Feature Request",
    priority: "Low"
  },

  // --- Unique tickets (no duplicates) ---
  {
    title: "Export to CSV not including all columns",
    description: "When exporting the reports table to CSV, the 'Last Modified' and 'Assignee' columns are missing from the output file. All other columns export correctly. This started after the v2.3 update.",
    category: "Bug",
    priority: "Medium"
  },
  {
    title: "How do I reset my two-factor authentication?",
    description: "I got a new phone and can no longer access my 2FA codes. I need to reset my two-factor authentication to regain access to my account. What is the process?",
    category: "Question",
    priority: "High"
  },
  {
    title: "Add bulk user import via CSV upload",
    description: "As an admin, I need the ability to import multiple users at once by uploading a CSV file with their details (name, email, role). Currently I have to add users one by one which is very time-consuming.",
    category: "Feature Request",
    priority: "Medium"
  },
  {
    title: "Dashboard charts not loading on Safari",
    description: "The analytics dashboard charts render as blank white boxes on Safari 17. The data tables below the charts load fine. This seems to be a Safari-specific rendering issue with the charting library.",
    category: "Bug",
    priority: "Medium"
  },
  {
    title: "Webhook notifications arriving with 30-minute delay",
    description: "Our webhook endpoint is receiving event notifications approximately 30 minutes after the actual event occurs. We need real-time delivery for our integration pipeline. This delay started around March 15th.",
    category: "Bug",
    priority: "Critical"
  },
  {
    title: "Add keyboard shortcuts for common actions",
    description: "Power users would benefit from keyboard shortcuts for actions like creating new items (Ctrl+N), saving (Ctrl+S), and navigating between tabs. This would significantly improve productivity.",
    category: "Feature Request",
    priority: "Low"
  },
  {
    title: "API rate limit error when syncing large datasets",
    description: "When attempting to sync more than 10,000 records via the REST API, we consistently hit rate limit errors (HTTP 429). Our current plan should allow higher throughput. Need the limit increased or a bulk sync endpoint.",
    category: "Bug",
    priority: "High"
  }
];
