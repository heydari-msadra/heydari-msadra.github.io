---
layout: archive
title: ""
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

<html>
<!-- Load Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
    tailwind.config = {
        theme: {
            extend: {
                fontFamily: {
                    sans: ['Inter', 'sans-serif'],
                    serif: ['Georgia', 'Times New Roman', 'serif'],
                },
                colors: {
                    'gla-blue': '#1e3a8a', /* University of Glasgow Primary Blue */
                    'primary-text': '#1f2937', /* Dark Gray for main text */
                    'accent-link': '#3b82f6', /* Blue for links */
                }
            }
        }
    }
</script>
<style>
    /* Custom styling for better presentation and alignment */
    /* Set a height for the object/embed to ensure the PDF viewer is visible */
    .pdf-container {
        /* Use a standard large height for academic CVs */
        min-height: 100vh;
        width: 100%;
        margin-top: 1.5rem;
    }
    .pdf-viewer {
        width: 100%;
        min-height: 100vh;
        border: 1px solid #e5e7eb; /* Light border */
        border-radius: 0.5rem;
    }
</style>

<!-- Main Content Wrapper (Adopted from your Teaching/Research Template) -->
<div class="max-w-4xl mx-auto p-4 md:p-8 bg-white rounded-xl shadow-xl">
    
  <!-- Header Section -->
  <h1 class="text-xl md:text-xl font-extrabold text-gray-900 mb-1 font-sans">Curriculum Vitae (CV)</h1>
  <p class="text-sm text-gray-500 mb-6 border-b pb-3 font-sans">Latest Version: October 2024</p>
    
  <!-- Download Link (Visible at all times) -->
  <div class="text-sm mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
      <p class="text-sm font-medium text-indigo-700">
          Having trouble viewing the PDF below?
      </p>
      <a 
          href="https://heydari-msadra.github.io/files//Heydari_MS_CV%20[Oct%2030th,%202024].pdf" 
          target="_blank" 
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent-link hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150"
          download
      >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L10 11.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v7a1 1 0 11-2 0V3a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Download CV (PDF)
      </a>
  </div>

  <!-- PDF Viewer -->
  <div class="pdf-container">
      <!-- Using the <iframe> tag is the most reliable way to embed PDFs across modern browsers -->
      <iframe 
          src="https://heydari-msadra.github.io/files//Heydari_MS_CV%20[Oct%2030th,%202024].pdf" 
          class="pdf-viewer" 
          title="Sadra Heydari Curriculum Vitae"
          loading="lazy"
      >
          <!-- Fallback content if the browser cannot display the iframe/PDF -->
          <div class="p-6 text-center text-gray-600">
              <p>Your browser does not support inline PDFs. Please use the download button above to view the document.</p>
          </div>
      </iframe>
  </div>

</div>
</html>

