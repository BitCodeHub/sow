# SOW Copilot

AI-powered Statement of Work (SOW) analyzer and reviewer.

## Features

- **Document Upload**: Upload DOCX files for template and new SOW documents
- **AI Analysis**: Deep comparison of sections, clauses, and terms using OpenAI GPT-4
- **Issue Detection**: Identifies legal risks, financial changes, scope modifications, unclear language
- **Side-by-Side View**: Compare template and new SOW with highlighted differences
- **Inline Editing**: Edit sections directly in the browser
- **AI Suggestions**: Apply AI-generated improvements with one click
- **Export**: Download revised SOW as DOCX

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Azure OpenAI resource with GPT-4 deployment

### Installation

1. Clone the repository:
   ```bash
   cd sow
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` with your Azure OpenAI credentials:
   ```
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_API_KEY=your-api-key-here
   AZURE_OPENAI_API_VERSION=2024-08-01-preview
   AZURE_OPENAI_DEPLOYMENT=gpt-4.1
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload Documents**: Upload an approved template SOW and a new draft SOW
2. **Analyze**: Click "Analyze with AI" to compare documents
3. **Review**: Browse issues by category in the sidebar
4. **Edit**: Click on sections to edit, or apply AI suggestions
5. **Export**: Download the revised SOW as a DOCX file

## Issue Categories

- **Legal Risk**: Changes to liability, termination, IP, confidentiality clauses
- **Financial**: Changes to amounts, payment terms, pricing
- **Deliverables & Scope**: Added, removed, or modified deliverables
- **Language & Clarity**: Undefined acronyms, vague terms, inconsistent terminology
- **Formatting**: Missing sections, wrong ordering, missing boilerplate

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Azure OpenAI (GPT-4.1)
- **Document Processing**: mammoth (DOCX parsing), docx (DOCX generation)

## Security Notes

- All documents are processed in memory and not permanently stored
- OpenAI API calls use data-isolated endpoints (data not used for training)
- HTTPS required in production
- Role-based access should be implemented for production deployment

## License

MIT License
