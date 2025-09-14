# Personal Expense Tracker

A full-stack web application for automated expense tracking and annual financial reporting. Upload multiple bank statement PDFs, process them month-by-month, and generate professional tax-ready reports.

## 🚀 Features

### **Batch PDF Processing**
- **Multi-File Upload**: Upload multiple bank statement PDFs at once
- **Auto Month Detection**: Automatically detects months from PDF filenames (e.g., "January_2024.pdf", "Feb-statement.pdf")
- **Smart Queue System**: Process PDFs in chronological order (January → December)

### **Transaction Management**
- **Automatic Extraction**: Extract transaction data from PDF bank statements
- **Add/Edit/Delete**: Full CRUD operations for transactions
- **Smart Categorization**: Auto-categorize expenses with manual override
- **Date Sorting**: Transactions sorted chronologically (earliest to latest)

### **Annual Workflow**
- **Year-Based Organization**: Process complete years of financial data
- **Month-by-Month Review**: Complete each month before moving to the next
- **Progress Tracking**: Visual progress indicator showing completion status
- **Seamless Navigation**: "Complete Month & Next PDF" workflow

### **Professional Reporting**
- **Annual Summary**: Complete financial overview with monthly breakdowns
- **Visual Charts**: Pie charts, bar charts, and category analysis
- **PDF Export**: Generate tax-ready PDF reports by year
- **Category Insights**: Detailed expense breakdown by category

## 🛠️ Technology Stack

### Backend
- **Python Flask** - REST API server
- **pdfplumber** - PDF text and table extraction
- **pandas** - Data manipulation and analysis
- **ReportLab** - Professional PDF report generation

### Frontend
- **Next.js 15** - React framework with TypeScript
- **Tailwind CSS** - Modern styling
- **Lucide React** - Beautiful icons
- **Recharts** - Data visualization
- **Axios** - API communication

## ⚡ Quick Start

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **npm** or **yarn**

### 🚀 Option 1: Automated Setup (Recommended)

#### One-Command Setup
```bash
git clone https://github.com/ChadR23/Finacial
cd personal-expense-tracker
python setup.py
```

#### One-Click Start
**Windows:**
```bash
start.bat
```

**macOS/Linux:**
```bash
./start.sh
```

The scripts will automatically:
- ✅ Set up Python virtual environment
- ✅ Install all dependencies
- ✅ Start both backend and frontend servers
- ✅ Open your browser to http://localhost:3000

---

### 🛠️ Option 2: Manual Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/personal-expense-tracker.git
cd personal-expense-tracker
```

#### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start Flask server
python app.py
```
Backend runs on `http://localhost:5000`

#### 3. Frontend Setup
```bash
cd frontend-nextjs

# Install dependencies
npm install

# Start development server
npm run dev
```
Frontend runs on `http://localhost:3000`

## 📖 How to Use

### Step 1: Upload PDFs
1. Select the year for your bank statements
2. Upload multiple PDF bank statements (drag & drop or file selection)
3. Review auto-detected months (✅ detected, ❌ manual selection needed)
4. Assign months to any undetected PDFs
5. Click "Start Processing"

### Step 2: Process Each Month
1. Review extracted transactions for accuracy
2. Add missing transactions using the "Add Transaction" button
3. Delete incorrect transactions using the trash icon
4. Adjust expense categories as needed
5. Click "Complete [Month] & Next PDF" to continue

### Step 3: Annual Summary
1. After all PDFs are processed, view the annual summary
2. Review monthly breakdowns and category analysis
3. Export professional PDF report for tax preparation

## 📁 Project Structure

```
personal-expense-tracker/
├── backend/
│   ├── app.py              # Flask API server
│   ├── requirements.txt    # Python dependencies
│   └── uploads/           # Temporary PDF storage
├── frontend-nextjs/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx    # Main application
│   │   │   └── layout.tsx  # App layout
│   │   ├── components/
│   │   │   ├── FileUpload.tsx      # Batch PDF upload
│   │   │   ├── TransactionViewer.tsx # Transaction processing
│   │   │   └── Summary.tsx         # Annual reporting
│   │   └── lib/
│   │       └── api.ts      # API client
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

## 🎯 API Endpoints

### File Processing
- `POST /api/upload` - Upload and process PDF with year/month
- `GET /api/years` - Get available years
- `GET /api/months/<year>` - Get months for a year

### Transaction Management
- `GET /api/transactions/<year>/<month>` - Get transactions by month
- `POST /api/transactions/<year>/<month>` - Add new transaction
- `PUT /api/transactions/<year>/<month>/<id>` - Update transaction
- `DELETE /api/transactions/<year>/<month>/<id>` - Delete transaction

### Workflow & Reporting
- `POST /api/transactions/<year>/<month>/process` - Mark month complete
- `GET /api/workflow/status/<year>` - Get workflow progress
- `GET /api/summary/<year>` - Get annual summary
- `GET /api/export-pdf/<year>` - Export annual PDF report

## 📊 Expense Categories

**Business Categories:**
- Software & Subscriptions
- Meals (50% Deductible)
- Travel & Transportation
- Office Supplies
- Marketing & Advertising
- Professional Services
- Equipment & Hardware
- Insurance
- Bank Fees
- Office Rent & Utilities

## 🧠 Auto-Categorization

The system intelligently categorizes transactions based on keywords:

- **Software**: Google, Microsoft, Adobe, Slack, Zoom, AWS, GitHub
- **Meals**: McDonald's, Starbucks, Restaurant, Cafe, Food delivery
- **Travel**: Uber, Lyft, Hotel, Airline, Gas stations
- **Supplies**: Office Depot, Staples, Amazon business purchases
- **Marketing**: Facebook Ads, Google Ads, LinkedIn, Advertising services

## 🎨 Key Features

### Smart Filename Detection
Upload PDFs with names like:
- `January_2024_statement.pdf` → Auto-detects January
- `Bank_Statement_Feb_2024.pdf` → Auto-detects February  
- `2024-03-statement.pdf` → Auto-detects March
- `Apr-bank-statement.pdf` → Auto-detects April

### Batch Workflow
1. **Upload Multiple PDFs** → Auto-organize by month
2. **Process Chronologically** → January through December
3. **Review Each Month** → Add/edit/delete transactions
4. **Complete & Continue** → Seamless month-to-month flow
5. **Annual Summary** → Comprehensive year-end report

### Professional Export
- Year-specific PDF reports (`expense-summary-2024.pdf`)
- Category breakdowns for tax preparation
- Monthly income/expense analysis
- Professional formatting for accountants

## 🔧 Configuration

### Expense Categories
Edit `CATEGORIES` in `backend/app.py` to customize expense categories.

### Auto-Categorization Rules
Modify `CATEGORIZATION_RULES` in `backend/app.py` to adjust keyword matching.

### File Size Limits
Default: 16MB per PDF. Adjust `MAX_CONTENT_LENGTH` in `backend/app.py`.

## 🐛 Troubleshooting

**PDF Not Processing**
- Ensure PDFs contain text (not scanned images)
- Check for table structure in bank statements
- Verify file size under 16MB limit

**No Transactions Extracted**
- Try different bank statement formats
- Check console for extraction errors
- Ensure PDFs are text-based, not image-only

**CORS Errors**
- Verify Flask backend is running on port 5000
- Check that frontend API calls point to correct backend URL

**Missing Dependencies**
```bash
# Backend
pip install -r requirements.txt

# Frontend
npm install
```

## 🚀 Production Deployment

### Backend (Python Flask)
- Use production WSGI server (Gunicorn, uWSGI)
- Set up proper database (PostgreSQL, MySQL)
- Configure environment variables
- Set up file storage (AWS S3, local storage)

### Frontend (Next.js)
- Build production bundle: `npm run build`
- Deploy to Vercel, Netlify, or traditional hosting
- Update API URLs for production backend

## 📄 License

This project is for personal use. Ensure compliance with your bank's terms of service when processing financial documents.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## ⚠️ Important Notes

- **Data Privacy**: All processing happens locally - no data sent to external services
- **File Security**: PDFs are temporarily stored and automatically deleted after processing
- **Single User**: Designed for personal use (multi-user features not included)
- **Data Persistence**: Uses in-memory storage (add database for production)

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section
2. Review console logs for error details
3. Ensure both backend and frontend are running
4. Verify PDF format compatibility

---

**Built with ❤️ for personal financial management and tax preparation**