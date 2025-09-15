from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pdfplumber
import pandas as pd
import os
import tempfile
import json
from datetime import datetime
import re
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, BaseDocTemplate, Frame, PageTemplate, NextPageTemplate
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Create uploads directory if it doesn't exist
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# In-memory storage for transactions organized by year/month (in production, use a database)
# Structure: {"2024": {"01": {"transactions": [...], "pdf_info": {...}}, "02": {...}}}
financial_data = {}

# Debug: Print initial state
print("Backend starting - financial_data initialized:", financial_data)

# Predefined categories
CATEGORIES = [
    "Uncategorized",
    "Processing",
    "Bank Fees",
    "Advertisement",
    "Marketing",
    "Repairs and Maintenance",
    "EV/Gas",
    "Supplies",
    "Software",
    "Meals 50%",
    "Shipping",
    "Travel",
    "Utilities",
    "Office Rent",
    "Professional Services",
    "Equipment",
    "Sales",
    "Insurance",
    "Other"
]

# Rule-based categorization keywords
CATEGORIZATION_RULES = {
    # Payments/processors
    "Processing": ["square", "stripe", "paypal"],
    # Fees
    "Bank Fees": ["fee", "charge", "interest", "overdraft"],
    # Advertising/marketing
    "Advertisement": ["photo", "photohub", "printing", "ad", "advertisement"],
    "Marketing": ["facebook", "instagram", "google ads", "advertising", "marketing"],
    # Repairs and maintenance
    "Repairs and Maintenance": ["home depot", "lowe", "advance auto", "autozone", "autopart", "repair", "maintenance"],
    # Fuel/charging
    "EV/Gas": ["supercharging", "super charging", "gas station", "fuel"],
    # Supplies
    "Supplies": ["office depot", "staples", "ikea", "amazon", "supplies", "paper", "ink"],
    # Software/SaaS
    "Software": ["google svcs", "google", "microsoft", "adobe", "slack", "zoom", "dropbox", "aws", "github", "canva", "expens"],
    # Meals
    "Meals 50%": ["mcdonald", "starbucks", "chick-fil-a", "chipotle", "wendy", "burger king", "dunkin", "panera", "subway", "domino"],
    # Shipping
    "Shipping": ["ups store", "fedex", "usps", "shipping"],
    # Travel
    "Travel": ["uber", "lyft", "hotel", "airline", "parking"],
    # Utilities
    "Utilities": ["bge", "balt gas", "gas and electric", "utility", "utilities", "electric", "water", "verizon", "comcast"],
    # Professional services
    "Professional Services": ["legal", "accounting", "consulting", "lawyer", "cpa"]
}

# Vendor normalization rules to group similar vendor strings under one name
VENDOR_NORMALIZATION_RULES = [
    (re.compile(r"\bAFFIRM\b", re.IGNORECASE), "Affirm"),
    (re.compile(r"\bGOO?GLE\b", re.IGNORECASE), "Google"),
    (re.compile(r"\bGSUITE\b|\bWORKSPACE\b", re.IGNORECASE), "Google"),
    (re.compile(r"\bPAY\s*PAL\b|\bPAYPAL\b", re.IGNORECASE), "PayPal"),
    (re.compile(r"\bAMAZON\b", re.IGNORECASE), "Amazon"),
    (re.compile(r"MCDONALD", re.IGNORECASE), "McDonald's"),
    (re.compile(r"\bSTARBUCKS\b", re.IGNORECASE), "Starbucks"),
    (re.compile(r"HOME\s*DEPOT", re.IGNORECASE), "The Home Depot"),
    (re.compile(r"\bAPPLE\b|APPLE\.?COM|APPLECARD", re.IGNORECASE), "Apple"),
    (re.compile(r"\bMICROSOFT\b|\bMSFT\b", re.IGNORECASE), "Microsoft"),
    (re.compile(r"\bUBER\b", re.IGNORECASE), "Uber"),
    (re.compile(r"\bLYFT\b", re.IGNORECASE), "Lyft"),
]

def normalize_vendor(description: str) -> str:
    """Map noisy transaction descriptions to a normalized vendor name.
    Uses explicit regex rules first, then a heuristic fallback.
    """
    if not description:
        return "Unknown"
    for pattern, name in VENDOR_NORMALIZATION_RULES:
        if pattern.search(description):
            return name
    # Fallback: strip numbers/symbols and take first 2-3 words
    cleaned = re.sub(r"[^A-Za-z\s]", "", description).strip()
    if not cleaned:
        return description
    words = cleaned.split()
    candidate = " ".join(words[:3]) if len(words) >= 3 else " ".join(words)
    return candidate.title()

def categorize_transaction(description, amount=None):
    """Auto-categorize transaction based on description keywords"""
    description_lower = description.lower()
    # Special high-priority logic (examples requested)
    if "tesla" in description_lower:
        if "super" in description_lower or "charge" in description_lower:
            return "EV/Gas"
        return "Repairs and Maintenance"
    if "home depot" in description_lower:
        return "Repairs and Maintenance"

    # User-provided mapping rules
    if "hdphotohub" in description_lower:
        return "Software"
    if "affirm" in description_lower:
        return "Equipment"
    if "amex" in description_lower:
        return "Bank Fees"
    if "square inc" in description_lower or description_lower.startswith("square ") or description_lower.startswith("sq *"):
        # Positive amounts are sales; negatives back out to Uncategorized per request
        if amount is not None and amount > 0:
            return "Sales"
        return "Uncategorized"
    if "apple" in description_lower:
        return "Software"
    if "bk od amer" in description_lower:
        return "Bank Fees"
    if "cubicasa" in description_lower:
        return "Software"

    for category, keywords in CATEGORIZATION_RULES.items():
        for keyword in keywords:
            if keyword in description_lower:
                return category
    
    return "Uncategorized"

def extract_transactions_from_pdf(pdf_path):
    """Extract transaction data from PDF bank statement"""
    transactions_data = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            print(f"Processing PDF with {len(pdf.pages)} pages")
            
            for page_num, page in enumerate(pdf.pages):
                print(f"Processing page {page_num + 1}")
                
                # Try to extract tables first
                tables = page.extract_tables()
                print(f"Found {len(tables) if tables else 0} tables on page {page_num + 1}")
                
                if tables:
                    for table_num, table in enumerate(tables):
                        print(f"Processing table {table_num + 1} with {len(table)} rows")
                        
                        # Look for transaction rows (typically have date, description, amount)
                        for row_num, row in enumerate(table):
                            if row and len(row) >= 3:
                                # Clean the row data
                                cleaned_row = [cell.strip() if cell else "" for cell in row]
                                print(f"Row {row_num}: {cleaned_row}")
                                
                                # Skip header rows and empty rows
                                if not cleaned_row[0] or not any(cleaned_row):
                                    continue
                                
                                # Try to identify transaction rows
                                # Look for date pattern and amount pattern
                                date_str = cleaned_row[0]
                                description = " ".join(cleaned_row[1:-1]) if len(cleaned_row) > 2 else cleaned_row[1]
                                amount_str = cleaned_row[-1] if len(cleaned_row) > 1 else ""
                                
                                print(f"Checking: date='{date_str}', description='{description}', amount='{amount_str}'")
                                
                                # Check if this looks like a transaction row
                                if (re.match(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', date_str) and 
                                    re.search(r'[\d,]+\.?\d*', amount_str)):
                                    
                                    try:
                                        # Parse amount (remove commas, handle negative amounts)
                                        amount_clean = re.sub(r'[,$]', '', amount_str)
                                        if amount_clean.startswith('(') and amount_clean.endswith(')'):
                                            # Negative amount in parentheses
                                            amount_clean = '-' + amount_clean[1:-1]
                                        amount = float(amount_clean)
                                        
                                        # Parse date - try different formats
                                        try:
                                            date_obj = datetime.strptime(date_str, '%m/%d/%y').date()
                                        except ValueError:
                                            try:
                                                date_obj = datetime.strptime(date_str, '%m/%d/%Y').date()
                                            except ValueError:
                                                print(f"Could not parse date: {date_str}")
                                                continue
                                        
                                        # Auto-categorize
                                        category = categorize_transaction(description, amount)
                                        
                                        transaction = {
                                            "date": date_obj.isoformat(),
                                            "description": description,
                                            "amount": amount,
                                            "category": category
                                        }
                                        
                                        transactions_data.append(transaction)
                                        print(f"Added transaction: {transaction}")
                                        
                                    except (ValueError, TypeError) as e:
                                        print(f"Error parsing row: {e}")
                                        continue
                
                # Always try text extraction (since tables weren't found)
                print(f"No tables found, trying text extraction on page {page_num + 1}")
                text = page.extract_text()
                if text:
                    print(f"Extracted text length: {len(text)} characters")
                    print(f"First 500 characters: {text[:500]}")
                    
                    # Simple text parsing for transaction lines
                    lines = text.split('\n')
                    print(f"Found {len(lines)} lines of text")
                    
                    for line_num, line in enumerate(lines):
                        line = line.strip()
                        if not line:
                            continue
                            
                        # Look for lines with date and amount patterns
                        if re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', line) and re.search(r'[\d,]+\.?\d*', line):
                            print(f"Potential transaction line {line_num}: {line}")
                            
                            # Try different parsing approaches
                            # Approach 1: Split by spaces
                            parts = line.split()
                            if len(parts) >= 3:
                                try:
                                    date_str = parts[0]
                                    amount_str = parts[-1]
                                    description = " ".join(parts[1:-1])
                                    
                                    print(f"Parsed: date='{date_str}', description='{description}', amount='{amount_str}'")
                                    
                                    amount_clean = re.sub(r'[,$]', '', amount_str)
                                    if amount_clean.startswith('(') and amount_clean.endswith(')'):
                                        amount_clean = '-' + amount_clean[1:-1]
                                    amount = float(amount_clean)
                                    
                                    # Try different date formats
                                    try:
                                        date_obj = datetime.strptime(date_str, '%m/%d/%y').date()
                                    except ValueError:
                                        try:
                                            date_obj = datetime.strptime(date_str, '%m/%d/%Y').date()
                                        except ValueError:
                                            print(f"Could not parse date: {date_str}")
                                            continue
                                    category = categorize_transaction(description, amount)
                                    
                                    transaction = {
                                        "date": date_obj.isoformat(),
                                        "description": description,
                                        "amount": amount,
                                        "category": category
                                    }
                                    
                                    transactions_data.append(transaction)
                                    print(f"Added transaction: {transaction}")
                                    
                                except (ValueError, TypeError) as e:
                                    print(f"Error parsing line: {e}")
                                    continue
                else:
                    print(f"No text extracted from page {page_num + 1}")
    
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        return []
    
    return transactions_data

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle PDF file upload and extract transactions with year/month organization"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    year = request.form.get('year')
    month = request.form.get('month')
    
    print(f"Upload request received: file={file.filename}, year={year}, month={month}")
    print(f"Current financial_data keys before upload: {list(financial_data.keys())}")
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not year or not month:
        return jsonify({'error': 'Year and month are required'}), 400
    
    if file and file.filename.lower().endswith('.pdf'):
        try:
            # Save uploaded file temporarily
            filename = file.filename
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Extract transactions from PDF
            extracted_transactions = extract_transactions_from_pdf(filepath)
            
            # Add unique IDs to transactions
            for i, transaction in enumerate(extracted_transactions):
                transaction['id'] = f"{year}_{month}_{filename}_{i}"
            
            # Initialize year/month structure if needed
            if year not in financial_data:
                financial_data[year] = {}
            if month not in financial_data[year]:
                financial_data[year][month] = {
                    'transactions': [],
                    'pdf_info': None,
                    'processed': False
                }
            
            # Store transactions and PDF info
            financial_data[year][month]['transactions'] = extracted_transactions
            financial_data[year][month]['pdf_info'] = {
                'filename': filename,
                'upload_date': datetime.now().isoformat(),
                'transaction_count': len(extracted_transactions)
            }
            
            print(f"Data stored successfully for {year}/{month}")
            print(f"Financial_data keys after upload: {list(financial_data.keys())}")
            if year in financial_data:
                print(f"Months in {year}: {list(financial_data[year].keys())}")
            
            # Clean up uploaded file
            os.remove(filepath)
            
            return jsonify({
                'message': 'File processed successfully',
                'transactions': extracted_transactions,
                'year': year,
                'month': month,
                'total_transactions': len(extracted_transactions)
            })
            
        except Exception as e:
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500
    
    return jsonify({'error': 'Invalid file type. Please upload a PDF file.'}), 400

# New API endpoints for multi-PDF workflow

@app.route('/api/years', methods=['GET'])
def get_years():
    """Get all available years"""
    return jsonify({'years': list(financial_data.keys())})

@app.route('/api/months/<year>', methods=['GET'])
def get_months(year):
    """Get all available months for a specific year"""
    if year in financial_data:
        return jsonify({'months': list(financial_data[year].keys())})
    return jsonify({'months': []})

@app.route('/api/transactions/<year>/<month>', methods=['GET'])
def get_transactions_by_month(year, month):
    """Get transactions for a specific year/month"""
    if year in financial_data and month in financial_data[year]:
        return jsonify({
            'transactions': financial_data[year][month]['transactions'],
            'pdf_info': financial_data[year][month]['pdf_info'],
            'processed': financial_data[year][month]['processed']
        })
    return jsonify({'transactions': [], 'pdf_info': None, 'processed': False})

@app.route('/api/transactions/<year>/<month>/process', methods=['POST'])
def mark_month_processed(year, month):
    """Mark a month as processed"""
    print(f"Processing request to mark {year}/{month} as processed")
    print(f"Available years: {list(financial_data.keys())}")
    
    if year in financial_data:
        print(f"Available months for {year}: {list(financial_data[year].keys())}")
        if month in financial_data[year]:
            financial_data[year][month]['processed'] = True
            print(f"Successfully marked {year}/{month} as processed")
            return jsonify({'message': 'Month marked as processed'})
        else:
            print(f"Month {month} not found in year {year}")
            return jsonify({'error': f'Month {month} not found in year {year}'}), 404
    else:
        print(f"Year {year} not found in financial_data")
        return jsonify({'error': f'Year {year} not found'}), 404

@app.route('/api/workflow/status/<year>', methods=['GET'])
def get_workflow_status(year):
    """Get workflow completion status for a year"""
    if year not in financial_data:
        return jsonify({'total_months': 0, 'processed_months': 0, 'completed': False})
    
    total_months = len(financial_data[year])
    processed_months = sum(1 for month_data in financial_data[year].values() if month_data['processed'])
    
    return jsonify({
        'total_months': total_months,
        'processed_months': processed_months,
        'completed': processed_months == total_months and total_months > 0,
        'months': {month: data['processed'] for month, data in financial_data[year].items()}
    })

@app.route('/api/transactions/<year>/<month>/<transaction_id>', methods=['PUT'])
def update_transaction(year, month, transaction_id):
    """Update a specific transaction"""
    data = request.get_json()
    
    if year in financial_data and month in financial_data[year]:
        for transaction in financial_data[year][month]['transactions']:
            if transaction.get('id') == transaction_id:
                if 'category' in data:
                    transaction['category'] = data['category']
                if 'description' in data:
                    transaction['description'] = data['description']
                if 'amount' in data:
                    transaction['amount'] = data['amount']
                if 'date' in data:
                    transaction['date'] = data['date']
                
                return jsonify({'message': 'Transaction updated successfully', 'transaction': transaction})
    
    return jsonify({'error': 'Transaction not found'}), 404

@app.route('/api/transactions/<year>/<month>/<transaction_id>', methods=['DELETE'])
def delete_transaction(year, month, transaction_id):
    """Delete a specific transaction"""
    if year in financial_data and month in financial_data[year]:
        transactions_list = financial_data[year][month]['transactions']
        for i, transaction in enumerate(transactions_list):
            if transaction.get('id') == transaction_id:
                deleted_transaction = transactions_list.pop(i)
                return jsonify({'message': 'Transaction deleted successfully', 'transaction': deleted_transaction})
    
    return jsonify({'error': 'Transaction not found'}), 404

@app.route('/api/transactions/<year>/<month>', methods=['POST'])
def add_transaction(year, month):
    """Add a new transaction to a specific month"""
    data = request.get_json()
    
    required_fields = ['date', 'description', 'amount']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields: date, description, amount'}), 400
    
    if year not in financial_data:
        financial_data[year] = {}
    if month not in financial_data[year]:
        financial_data[year][month] = {
            'transactions': [],
            'pdf_info': None,
            'processed': False
        }
    
    # Generate unique ID
    transaction_count = len(financial_data[year][month]['transactions'])
    transaction_id = f"{year}_{month}_manual_{transaction_count}"
    
    new_transaction = {
        'id': transaction_id,
        'date': data['date'],
        'description': data['description'],
        'amount': float(data['amount']),
        'category': data.get('category', 'Uncategorized')
    }
    
    financial_data[year][month]['transactions'].append(new_transaction)
    
    return jsonify({'message': 'Transaction added successfully', 'transaction': new_transaction})

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get list of available categories"""
    return jsonify({'categories': CATEGORIES})

@app.route('/api/summary/<year>', methods=['GET'])
def get_summary(year):
    """Get aggregated summary of all transactions for a specific year"""
    if year not in financial_data:
        return jsonify({
            'total_income': 0,
            'total_expenses': 0,
            'category_totals': {},
            'transaction_count': 0,
            'monthly_totals': {}
        })
    
    # Collect all transactions for the year
    all_transactions = []
    monthly_totals = {}
    
    for month, month_data in financial_data[year].items():
        month_transactions = month_data['transactions']
        all_transactions.extend(month_transactions)
        
        # Calculate monthly totals
        if month_transactions:
            df_month = pd.DataFrame(month_transactions)
            df_month['amount'] = pd.to_numeric(df_month['amount'])
            monthly_income = df_month[df_month['amount'] > 0]['amount'].sum()
            monthly_expenses = abs(df_month[df_month['amount'] < 0]['amount'].sum())
            monthly_totals[month] = {
                'income': float(monthly_income),
                'expenses': float(monthly_expenses),
                'net': float(monthly_income - monthly_expenses)
            }
        else:
            monthly_totals[month] = {'income': 0, 'expenses': 0, 'net': 0}
    
    if not all_transactions:
        return jsonify({
            'total_income': 0,
            'total_expenses': 0,
            'category_totals': {},
            'transaction_count': 0,
            'monthly_totals': monthly_totals
        })
    
    # Convert to DataFrame for easier aggregation
    df = pd.DataFrame(all_transactions)
    df['amount'] = pd.to_numeric(df['amount'])
    
    # Calculate totals
    total_income = df[df['amount'] > 0]['amount'].sum()
    total_expenses = abs(df[df['amount'] < 0]['amount'].sum())
    
    # Calculate category totals (only for expenses)
    expense_df = df[df['amount'] < 0].copy()
    expense_df['amount'] = abs(expense_df['amount'])
    category_totals = expense_df.groupby('category')['amount'].sum().to_dict()
    
    return jsonify({
        'total_income': float(total_income),
        'total_expenses': float(total_expenses),
        'category_totals': {k: float(v) for k, v in category_totals.items()},
        'transaction_count': len(all_transactions),
        'monthly_totals': monthly_totals
    })

@app.route('/api/export-pdf/<year>', methods=['GET'])
def export_pdf(year):
    """Generate and return a PDF report of expense summary for a specific year"""
    print(f"Export PDF requested for year: {year}")
    print(f"Available years in financial_data: {list(financial_data.keys())}")
    
    # Collect all transactions for the year (gracefully handle missing year)
    all_transactions = []
    if year in financial_data:
        print(f"Months available for {year}: {list(financial_data[year].keys())}")
        for month, month_data in financial_data[year].items():
            month_transactions = month_data['transactions']
            print(f"Month {month}: {len(month_transactions)} transactions")
            all_transactions.extend(month_transactions)
    else:
        print(f"Year {year} not found in financial_data - generating empty summary PDF")
    
    print(f"Total transactions for {year}: {len(all_transactions)}")
    
    try:
        # Calculate summary data
        # Build DataFrame even if empty
        if all_transactions:
            df = pd.DataFrame(all_transactions)
        else:
            df = pd.DataFrame(columns=['date', 'description', 'amount', 'category'])
        if 'amount' in df.columns:
            df['amount'] = pd.to_numeric(df['amount'])
        else:
            df['amount'] = pd.Series(dtype=float)
        
        total_income = df[df['amount'] > 0]['amount'].sum() if not df.empty else 0.0
        total_expenses = abs(df[df['amount'] < 0]['amount'].sum()) if not df.empty else 0.0
        
        expense_df = df[df['amount'] < 0].copy() if not df.empty else pd.DataFrame(columns=['date','description','amount','category'])
        if not expense_df.empty:
            expense_df['amount'] = abs(expense_df['amount'])
            category_totals = expense_df.groupby('category')['amount'].sum().to_dict()
        else:
            category_totals = {}
        
        # Create temporary file for PDF
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.close()
        
        # Create PDF document with multiple page templates (portrait for page 1, landscape for matrix pages)
        doc = BaseDocTemplate(
            temp_file.name,
            pagesize=letter,
            leftMargin=0.5*inch,
            rightMargin=0.5*inch,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch
        )
        # Portrait template (first page)
        portrait_frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='portrait_frame')
        portrait_template = PageTemplate(id='Portrait', frames=[portrait_frame], pagesize=letter)
        # Landscape template (for transactions matrix)
        landscape_size = landscape(letter)
        landscape_width = landscape_size[0] - doc.leftMargin - doc.rightMargin
        landscape_height = landscape_size[1] - doc.topMargin - doc.bottomMargin
        landscape_frame = Frame(doc.leftMargin, doc.bottomMargin, landscape_width, landscape_height, id='landscape_frame')
        landscape_template = PageTemplate(id='Landscape', frames=[landscape_frame], pagesize=landscape_size)
        doc.addPageTemplates([portrait_template, landscape_template])
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            alignment=1  # Center alignment
        )
        title = Paragraph(f"Business Expense Summary - {year}", title_style)
        story.append(title)
        
        # Date range
        if all_transactions:
            dates = [datetime.fromisoformat(t['date']) for t in all_transactions]
            date_range = f"Period: {min(dates).strftime('%B %d, %Y')} - {max(dates).strftime('%B %d, %Y')}"
        else:
            date_range = "Period: No transactions available"
        date_para = Paragraph(date_range, styles['Normal'])
        story.append(date_para)
        story.append(Spacer(1, 20))
        
        # Summary statistics
        summary_data = [
            ['Total Income', f"${total_income:,.2f}"],
            ['Total Expenses', f"${total_expenses:,.2f}"],
            ['Net Income', f"${total_income - total_expenses:,.2f}"],
            ['Total Transactions', str(len(all_transactions))]
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 30))
        
        # Category breakdown
        category_header = Paragraph("Expense Categories", styles['Heading2'])
        story.append(category_header)
        story.append(Spacer(1, 12))
        
        if category_totals:
            # Sort categories by amount (descending)
            sorted_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
            
            category_data = [['Category', 'Amount', 'Percentage']]
            for category, amount in sorted_categories:
                percentage = (amount / total_expenses * 100) if total_expenses > 0 else 0
                category_data.append([
                    category,
                    f"${amount:,.2f}",
                    f"{percentage:.1f}%"
                ])
            
            category_table = Table(category_data, colWidths=[2.5*inch, 1.5*inch, 1*inch])
            category_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 0), (2, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(category_table)
        else:
            no_data = Paragraph("No expense data available", styles['Normal'])
            story.append(no_data)

        # Switch to landscape for matrix pages
        story.append(NextPageTemplate('Landscape'))
        story.append(PageBreak())
        matrix_header = Paragraph("Expenses by Vendor/Category Across Months", styles['Heading2'])
        story.append(matrix_header)
        story.append(Spacer(1, 12))

        # Prepare month labels and ordering
        month_numbers = [f"{i:02d}" for i in range(1, 13)]
        month_labels = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ]

        # Build expense-only dataframe with month column
        if not expense_df.empty:
            expense_df = expense_df.copy()
            expense_df['amount'] = pd.to_numeric(expense_df['amount'])
            # original df had negative for expenses; we converted to positive above
            # Ensure month is extracted correctly from ISO date
            expense_df['month'] = expense_df['date'].apply(lambda d: d[5:7])

            # Normalize vendor names to group similar strings
            pivot_source = expense_df.copy()
            pivot_source['vendor'] = pivot_source['description'].apply(normalize_vendor)
            pivot = pivot_source.pivot_table(
                index='vendor',
                columns='month',
                values='amount',
                aggfunc='sum',
                fill_value=0.0
            )

            # Ensure all months present in columns in correct order
            for m in month_numbers:
                if m not in pivot.columns:
                    pivot[m] = 0.0
            pivot = pivot[month_numbers]

            # Sort rows by total descending
            pivot['__row_total__'] = pivot.sum(axis=1)
            pivot = pivot.sort_values('__row_total__', ascending=False)

            # Build table data (wrap long descriptions)
            table_data = [["Expenses"] + month_labels]
            for desc, row in pivot.drop(columns='__row_total__').iterrows():
                row_values = [
                    (f"${val:,.2f}" if abs(val) > 0.004 else '-')
                    for val in row.tolist()
                ]
                desc_para = Paragraph(str(desc), styles['Normal'])
                table_data.append([desc_para] + row_values)

            # Bottom totals per month
            monthly_totals = [pivot.drop(columns='__row_total__')[m].sum() for m in month_numbers]
            total_row = ["Total Cash Out"] + [f"${v:,.2f}" if v else '-' for v in monthly_totals]
            table_data.append(total_row)

            # Compute dynamic column widths to fit page width (wider in landscape)
            available_width = landscape_width
            # Make Expense column smaller so month columns are wider
            first_col_width = min(max(2.4*inch, available_width * 0.27), 3.6*inch)
            month_col_width = (available_width - first_col_width) / 12.0
            col_widths = [first_col_width] + [month_col_width] * 12
            matrix_table = Table(table_data, colWidths=col_widths, repeatRows=1)
            matrix_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('ALIGN', (1, 0), (-1, 0), 'CENTER'),
                ('ALIGN', (1, 1), (-1, -2), 'CENTER'),
                ('ALIGN', (1, -1), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(matrix_table)
        else:
            story.append(Paragraph("No expense transactions found for the year.", styles['Normal']))

        # Build PDF
        doc.build(story)
        
        # Return the PDF file
        return send_file(
            temp_file.name,
            as_attachment=True,
            download_name=f'expense-summary-{datetime.now().strftime("%Y-%m-%d")}.pdf',
            mimetype='application/pdf'
        )
        
    except Exception as e:
        return jsonify({'error': f'Error generating PDF: {str(e)}'}), 500

if __name__ == '__main__':
    print("=" * 50)
    print("🚀 Starting Flask backend server...")
    print("📊 Backend API: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, port=5000)
