#!/bin/bash

# Raftaar Order Picker - PDF Generation Script
# This script converts all markdown documentation to PDF format

echo "Converting Raftaar Order Picker documentation to PDF..."

# Check if pandoc is installed
if ! command -v pandoc &> /dev/null; then
    echo "Error: Pandoc is not installed. Please install it first:"
    echo "   macOS: brew install pandoc"
    echo "   Ubuntu: sudo apt-get install pandoc"
    echo "   Windows: Download from https://pandoc.org/installing.html"
    exit 1
fi

# Create PDFs directory if it doesn't exist
mkdir -p pdfs

# Try different PDF engines in order of preference
PDF_ENGINE=""

if command -v wkhtmltopdf &> /dev/null; then
    PDF_ENGINE="--pdf-engine=wkhtmltopdf"
    echo "Using wkhtmltopdf engine..."
elif command -v weasyprint &> /dev/null; then
    PDF_ENGINE="--pdf-engine=weasyprint"
    echo "Using weasyprint engine..."
else
    echo "No suitable PDF engine found. Converting to HTML instead..."
    echo "You can open the HTML files in a browser and print to PDF."
    
    # Convert to HTML instead
    echo "Converting README.md to HTML..."
    pandoc README.md -o pdfs/README.html --standalone --css=https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css
    
    echo "Converting SETUP.md to HTML..."
    pandoc SETUP.md -o pdfs/SETUP.html --standalone --css=https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css
    
    echo "Converting USER_GUIDE.md to HTML..."
    pandoc USER_GUIDE.md -o pdfs/USER_GUIDE.html --standalone --css=https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css
    
    echo "Converting RELEASE_NOTES.md to HTML..."
    pandoc RELEASE_NOTES.md -o pdfs/RELEASE_NOTES.html --standalone --css=https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css
    pandoc DEPENDENCIES.md -o pdfs/DEPENDENCIES.html --standalone --css=https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css

    
    # Create combined HTML
    echo "Creating combined documentation HTML..."
    pandoc README.md SETUP.md USER_GUIDE.md RELEASE_NOTES.md \
      --toc \
      --toc-depth=3 \
      --number-sections \
      --standalone \
      --css=https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css \
      --metadata title="Raftaar Order Picker - Complete Documentation" \
      --metadata author="Raftaar Development Team" \
      --metadata date="July 2025" \
      -o pdfs/Raftaar_Complete_Documentation.html
    
    echo "HTML generation complete!"
    echo "Files saved in: pdfs/"
    echo "   - README.html"
    echo "   - SETUP.html" 
    echo "   - USER_GUIDE.html"
    echo "   - RELEASE_NOTES.html"
    echo "   - Raftaar_Complete_Documentation.html"
    echo ""
    echo "To convert to PDF:"
    echo "1. Open each HTML file in a browser"
    echo "2. Press Cmd+P (Print)"
    echo "3. Select 'Save as PDF'"
    echo "4. Or install a PDF engine: brew install wkhtmltopdf"
    exit 0
fi

# Convert individual files to PDF
echo "Converting README.md..."
pandoc README.md -o pdfs/README.pdf $PDF_ENGINE

echo "Converting SETUP.md..."
pandoc SETUP.md -o pdfs/SETUP.pdf $PDF_ENGINE

echo "Converting USER_GUIDE.md..."
pandoc USER_GUIDE.md -o pdfs/USER_GUIDE.pdf $PDF_ENGINE

echo "Converting RELEASE_NOTES.md..."
pandoc RELEASE_NOTES.md -o pdfs/RELEASE_NOTES.pdf $PDF_ENGINE

# Create combined documentation
echo "Creating combined documentation..."
pandoc README.md SETUP.md USER_GUIDE.md RELEASE_NOTES.md \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --metadata title="Raftaar Order Picker - Complete Documentation" \
  --metadata author="Raftaar Development Team" \
  --metadata date="July 2025" \
  -o pdfs/Raftaar_Complete_Documentation.pdf $PDF_ENGINE

echo "PDF generation complete!"
echo "Files saved in: pdfs/"
echo "   - README.pdf"
echo "   - SETUP.pdf" 
echo "   - USER_GUIDE.pdf"
echo "   - RELEASE_NOTES.pdf"
echo "   - Raftaar_Complete_Documentation.pdf"
