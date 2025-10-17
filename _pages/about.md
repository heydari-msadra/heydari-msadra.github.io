---
permalink: /
title: ""
excerpt: "About me"
author_profile: true
redirect_from: 
  - /about/
  - /about.html
---

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About Me - Sadra Heydari</title>
    <!-- Load Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        // Using a slightly more academic-looking serif font for the body text
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
</head>
<body class="bg-gray-50 min-h-screen p-4 sm:p-8 font-serif text-primary-text">

    <div class="max-w-3xl mx-auto bg-white rounded-xl shadow-xl p-6 md:p-10 border-t-4 border-gla-blue">
        
        <!-- Header Section -->
        <h1 class="text-3xl md:text-4xl font-extrabold text-gray-900 mb-1 font-sans">About Me</h1>
        <p class="text-lg text-gray-500 mb-6 border-b pb-3 font-sans">PhD Student in Economics</p>
        
        <!-- Main Content - Single Column, Professional Look -->
        <div class="space-y-5 text-base leading-relaxed">

            <!-- Introduction and Research Focus -->
            <p>
                I am currently a <strong class="font-extrabold text-gray-800">PhD student in Economics</strong> at the 
                <a href="https://www.gla.ac.uk/schools/business/" class="text-accent-link hover:text-blue-700 font-semibold underline transition duration-200" target="_blank" rel="noopener noreferrer">Adam Smith Business School</a>, 
                <a href="https://www.gla.ac.uk/" class="text-accent-link hover:text-blue-700 font-semibold underline transition duration-200" target="_blank" rel="noopener noreferrer">University of Glasgow</a>, 
                where I work under the supervision of <strong class="font-extrabold text-gray-800">Professor Richard Dennis</strong>.
            </p>

            <p class="border-l-4 border-gla-blue pl-4 py-1 text-gray-800 italic bg-gray-50 rounded-r-md text-sm">
                My research is primarily focused on <strong class="font-extrabold text-gray-800">Industry Dynamics</strong> and the strategic interactions that shape market structure and innovation.
            </p>

            <!-- Academic Background Section -->
            <h2 class="text-xl font-bold text-gray-800 pt-4 border-t mt-6 font-sans">Academic Background</h2>

            <!-- Using definition list for structured, easy-to-read academic entries -->
            <dl class="space-y-5">
                
                <!-- MRes Entry -->
                <div class="border-l-2 border-gla-blue pl-3 py-1">
                    <dt class="text-lg font-extrabold text-gla-blue">MRes in Economics</dt>
                    <dd class="text-sm text-gray-600">University of Glasgow (2023–2025)</dd>
                    <dd class="text-xs mt-1 text-gray-500">
                        Completed prior to starting my PhD, this program established a strong foundation in advanced economic theory and econometrics.
                    </dd>
                </div>

                <!-- B.Sc. Entry -->
                <div class="border-l-2 border-gray-400 pl-3 py-1">
                    <dt class="text-lg font-extrabold text-gray-800">B.Sc. in Computer Engineering</dt>
                    <dd class="text-sm text-gray-600">
                        <a href="https://en.sharif.edu/" class="text-gray-700 hover:text-accent-link underline" target="_blank" rel="noopener noreferrer">Sharif University of Technology</a> (2018–2023)
                    </dd>
                    <dd class="text-xs mt-1 text-gray-500">
                        Includes a <strong class="font-extrabold text-gray-800">Minor in Economics</strong>. This background bridges computational methods and economic theory, providing a unique perspective I apply to studying firm behaviour and dynamic markets.
                    </dd>
                </div>
            </dl>
        </div>
    </div>

</body>

...
