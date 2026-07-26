import * as fs from "node:fs";
import * as path from "node:path";
import { paint, theme } from "../ui/theme.js";

interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

interface ScaffoldResult {
  success: boolean;
  files: GeneratedFile[];
  instructions: string[];
  error?: string;
}

const frameworkConfigs: Record<string, { language: string; extensions: string[]; packageManager: string }> = {
  react: { language: "typescript", extensions: [".tsx", ".ts", ".css"], packageManager: "npm" },
  nextjs: { language: "typescript", extensions: [".tsx", ".ts", ".css"], packageManager: "npm" },
  express: { language: "typescript", extensions: [".ts", ".js"], packageManager: "npm" },
  node: { language: "typescript", extensions: [".ts", ".js"], packageManager: "npm" },
  vue: { language: "typescript", extensions: [".vue", ".ts", ".css"], packageManager: "npm" },
  svelte: { language: "typescript", extensions: [".svelte", ".ts", ".css"], packageManager: "npm" },
  fastapi: { language: "python", extensions: [".py"], packageManager: "pip" },
  django: { language: "python", extensions: [".py", ".html"], packageManager: "pip" },
  flask: { language: "python", extensions: [".py", ".html"], packageManager: "pip" },
  rust: { language: "rust", extensions: [".rs", ".toml"], packageManager: "cargo" },
  go: { language: "go", extensions: [".go"], packageManager: "go" },
};

export function getSupportedFrameworks(): string[] {
  return Object.keys(frameworkConfigs);
}

export function getFrameworkConfig(framework: string) {
  return frameworkConfigs[framework.toLowerCase()] || null;
}

export function generateProjectFromDescription(
  framework: string,
  projectName: string,
  description: string,
  targetDir: string
): ScaffoldResult {
  const config = getFrameworkConfig(framework);
  if (!config) {
    return {
      success: false,
      files: [],
      instructions: [],
      error: `Unsupported framework: ${framework}. Supported: ${getSupportedFrameworks().join(", ")}`,
    };
  }

  const projectDir = path.join(targetDir, projectName);
  const files: GeneratedFile[] = [];
  const instructions: string[] = [];

  try {
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    switch (framework.toLowerCase()) {
      case "react":
        files.push(...generateReactProject(projectName, description));
        break;
      case "express":
        files.push(...generateExpressProject(projectName, description));
        break;
      case "nextjs":
        files.push(...generateNextjsProject(projectName, description));
        break;
      case "node":
        files.push(...generateNodeProject(projectName, description));
        break;
      default:
        files.push(...generateGenericProject(projectName, framework, description));
    }

    for (const file of files) {
      const filePath = path.join(projectDir, file.path);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, file.content);
    }

    instructions.push(`cd ${projectName}`);
    if (config.packageManager === "npm") {
      instructions.push("npm install");
      instructions.push("npm run dev");
    } else if (config.packageManager === "pip") {
      instructions.push("pip install -r requirements.txt");
      instructions.push("python app.py");
    } else if (config.packageManager === "cargo") {
      instructions.push("cargo run");
    } else if (config.packageManager === "go") {
      instructions.push("go run main.go");
    }

    return { success: true, files, instructions };
  } catch (err) {
    return {
      success: false,
      files,
      instructions,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function generateReactProject(name: string, description: string): GeneratedFile[] {
  const components = extractComponentNames(description);
  const hasRouting = /route|page|navigation/i.test(description);
  const hasState = /state|context|redux|zustand/i.test(description);
  const hasAPI = /api|fetch|axios|backend/i.test(description);

  const files: GeneratedFile[] = [
    {
      path: "package.json",
      content: JSON.stringify({
        name,
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc && vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          ...(hasRouting ? { "react-router-dom": "^6.20.0" } : {}),
          ...(hasAPI ? { axios: "^1.6.0" } : {}),
        },
        devDependencies: {
          "@types/react": "^18.2.0",
          "@types/react-dom": "^18.2.0",
          "@vitejs/plugin-react": "^4.0.0",
          typescript: "^5.0.0",
          vite: "^5.0.0",
        },
      }, null, 2),
      description: "Package configuration",
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
      description: "Vite configuration",
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          skipLibCheck: true,
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: true,
        },
        include: ["src"],
      }, null, 2),
      description: "TypeScript configuration",
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      description: "HTML entry point",
    },
    {
      path: "src/main.tsx",
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
      description: "React entry point",
    },
    {
      path: "src/App.tsx",
      content: generateReactApp(components, hasRouting, hasState),
      description: "Main App component",
    },
    {
      path: "src/index.css",
      content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: Inter, system-ui, sans-serif;
  line-height: 1.5;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}`,
      description: "Global styles",
    },
  ];

  if (hasRouting) {
    files.push({
      path: "src/pages/Home.tsx",
      content: `export function Home() {
  return (
    <div>
      <h1>Home</h1>
    </div>
  )
}`,
      description: "Home page component",
    });
    files.push({
      path: "src/components/Layout.tsx",
      content: `import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="layout">
      <nav>
        <a href="/">Home</a>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}`,
      description: "Layout component with navigation",
    });
  }

  if (hasAPI) {
    files.push({
      path: "src/api/client.ts",
      content: `import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)`,
      description: "API client configuration",
    });
  }

  if (hasState) {
    files.push({
      path: "src/store/index.ts",
      content: `import { useState, useCallback } from 'react'

interface AppState {
  count: number
  theme: 'light' | 'dark'
}

export function useAppState() {
  const [state, setState] = useState<AppState>({
    count: 0,
    theme: 'light',
  })

  const increment = useCallback(() => {
    setState(prev => ({ ...prev, count: prev.count + 1 }))
  }, [])

  const toggleTheme = useCallback(() => {
    setState(prev => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }))
  }, [])

  return { ...state, increment, toggleTheme }
}`,
      description: "State management hook",
    });
  }

  return files;
}

function generateReactApp(components: string[], hasRouting: boolean, hasState: boolean): string {
  if (hasRouting) {
    return `import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App`
  }

  if (components.length > 0) {
    const imports = components
      .map(c => `import { ${c} } from './components/${c}'`)
      .join('\n')
    const componentUsage = components.map(c => `<${c} />`).join('\n      ')

    return `import './App.css'
${imports}

function App() {
  return (
    <div className="app">
      <h1>Welcome to ${components.join(', ')}</h1>
      <div className="components">
      ${componentUsage}
      </div>
    </div>
  )
}

export default App`
  }

  return `import './App.css'

function App() {
  return (
    <div className="app">
      <h1>Welcome to your app</h1>
      <p>Start editing to see changes</p>
    </div>
  )
}

export default App`
}

function generateExpressProject(name: string, description: string): GeneratedFile[] {
  const hasAuth = /auth|login|jwt|session/i.test(description);
  const hasDB = /database|mongo|postgres|sql|prisma|typeorm/i.test(description);
  const hasAPI = /api|rest|graphql/i.test(description);

  const files: GeneratedFile[] = [
    {
      path: "package.json",
      content: JSON.stringify({
        name,
        version: "1.0.0",
        scripts: {
          dev: "tsx watch src/index.ts",
          build: "tsc",
          start: "node dist/index.js",
        },
        dependencies: {
          express: "^4.18.0",
          cors: "^2.8.5",
          dotenv: "^16.3.1",
          ...(hasAuth ? { jsonwebtoken: "^9.0.2", bcryptjs: "^2.4.3" } : {}),
          ...(hasDB ? { prisma: "^5.7.0" } : {}),
        },
        devDependencies: {
          "@types/express": "^4.17.0",
          "@types/cors": "^2.8.0",
          "@types/node": "^20.0.0",
          tsx: "^4.0.0",
          typescript: "^5.0.0",
        },
      }, null, 2),
      description: "Package configuration",
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "commonjs",
          lib: ["ES2020"],
          outDir: "./dist",
          rootDir: "./src",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          declaration: true,
          sourceMap: true,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
      }, null, 2),
      description: "TypeScript configuration",
    },
    {
      path: "src/index.ts",
      content: `import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { router } from './routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use('/api', router)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`)
})`,
      description: "Express server entry point",
    },
    {
      path: "src/routes/index.ts",
      content: `import { Router } from 'express'
import { healthRouter } from './health'
${hasAuth ? "import { authRouter } from './auth'" : ''}

export const router = Router()

router.use('/health', healthRouter)
${hasAuth ? "router.use('/auth', authRouter)" : ''}`,
      description: "Route aggregator",
    },
    {
      path: "src/routes/health.ts",
      content: `import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/', (req, res) => {
  res.json({ status: 'healthy' })
})`,
      description: "Health check route",
    },
  ];

  if (hasAuth) {
    files.push({
      path: "src/routes/auth.ts",
      content: `import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

export const authRouter = Router()

const users: Array<{ id: string; email: string; password: string }> = []

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body
  
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const user = { id: Date.now().toString(), email, password: hashedPassword }
  users.push(user)

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' })
  res.json({ token, user: { id: user.id, email } })
})

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  const user = users.find(u => u.email === email)

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' })
  res.json({ token, user: { id: user.id, email } })
})`,
      description: "Authentication routes",
    });
  }

  return files;
}

function generateNextjsProject(name: string, description: string): GeneratedFile[] {
  const hasDB = /database|mongo|postgres|prisma/i.test(description);
  const hasAuth = /auth|login|session/i.test(description);

  return [
    {
      path: "package.json",
      content: JSON.stringify({
        name,
        version: "1.0.0",
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
          lint: "next lint",
        },
        dependencies: {
          next: "^14.0.0",
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          ...(hasDB ? { "@prisma/client": "^5.7.0" } : {}),
          ...(hasAuth ? { nextauth: "^4.24.0" } : {}),
        },
        devDependencies: {
          "@types/node": "^20.0.0",
          "@types/react": "^18.2.0",
          typescript: "^5.0.0",
          ...(hasDB ? { prisma: "^5.7.0" } : {}),
        },
      }, null, 2),
      description: "Package configuration",
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./src/*"] },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        exclude: ["node_modules"],
      }, null, 2),
      description: "TypeScript configuration",
    },
    {
      path: "src/app/layout.tsx",
      content: `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '${name}',
  description: 'Generated by Flux',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
      description: "Root layout",
    },
    {
      path: "src/app/page.tsx",
      content: `export default function Home() {
  return (
    <main>
      <h1>Welcome to ${name}</h1>
    </main>
  )
}`,
      description: "Home page",
    },
    {
      path: "src/app/globals.css",
      content: `* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

a {
  color: inherit;
  text-decoration: none;
}`,
      description: "Global styles",
    },
  ];
}

function generateNodeProject(name: string, description: string): GeneratedFile[] {
  return [
    {
      path: "package.json",
      content: JSON.stringify({
        name,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "tsx watch src/index.ts",
          build: "tsc",
          start: "node dist/index.js",
        },
        devDependencies: {
          "@types/node": "^20.0.0",
          tsx: "^4.0.0",
          typescript: "^5.0.0",
        },
      }, null, 2),
      description: "Package configuration",
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "bundler",
          lib: ["ES2020"],
          outDir: "./dist",
          rootDir: "./src",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          declaration: true,
          sourceMap: true,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
      }, null, 2),
      description: "TypeScript configuration",
    },
    {
      path: "src/index.ts",
      content: `console.log('Hello from ${name}!')`,
      description: "Entry point",
    },
  ];
}

function generateGenericProject(name: string, framework: string, description: string): GeneratedFile[] {
  return [
    {
      path: "README.md",
      content: `# ${name}

${description}

## Framework
${framework}

## Getting Started
See framework documentation for setup instructions.`,
      description: "Project documentation",
    },
  ];
}

function extractComponentNames(description: string): string[] {
  const componentPatterns = [
    /(\w+)\s+component/i,
    /(\w+)\s+page/i,
    /(\w+)\s+section/i,
    /(\w+)\s+widget/i,
  ];

  const names: string[] = [];
  for (const pattern of componentPatterns) {
    const match = description.match(pattern);
    if (match?.[1]) {
      const name = match[1];
      names.push(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());
    }
  }

  return [...new Set(names)].slice(0, 5);
}

export function formatScaffoldResult(
  projectName: string,
  result: ScaffoldResult
): string {
  const output: string[] = [];

  if (result.success) {
    output.push(paint(`  ✓ Created project: ${projectName}`, theme.success));
    output.push("");
    output.push(paint("  Files generated:", theme.primary));

    for (const file of result.files) {
      output.push(paint(`    • ${file.path}`, theme.text));
      if (file.description) {
        output.push(paint(`      ${file.description}`, theme.dim));
      }
    }

    if (result.instructions.length > 0) {
      output.push("");
      output.push(paint("  Next steps:", theme.primary));
      for (const instruction of result.instructions) {
        output.push(paint(`    $ ${instruction}`, theme.accent));
      }
    }
  } else {
    output.push(paint(`  ✗ Failed to create project: ${result.error}`, theme.error));
  }

  return output.join("\n");
}
