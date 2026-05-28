import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  DocxEditor,
  type DocxEditorRef,
  createEmptyDocument,
  PluginHost,
  createTemplatePlugin,
  type ClickedVariable,
} from '@postnzt/docx-js-editor';
import { ExampleSwitcher } from '../../shared/ExampleSwitcher';
import { GitHubBadge } from '../../shared/GitHubBadge';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: '#f8fafc',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  fileInputLabel: {
    padding: '6px 12px',
    background: '#0f172a',
    color: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  },
  button: {
    padding: '6px 12px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: '#334155',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  newButton: {
    padding: '6px 12px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  status: {
    fontSize: '12px',
    color: '#64748b',
    padding: '4px 8px',
    background: '#f1f5f9',
    borderRadius: '4px',
  },
};

function useResponsiveLayout() {
  const calcZoom = () => {
    const pageWidth = 816 + 48; // 8.5in * 96dpi + padding
    const vw = window.innerWidth;
    return vw < pageWidth ? Math.max(0.35, Math.floor((vw / pageWidth) * 20) / 20) : 1.0;
  };

  const [zoom, setZoom] = useState(calcZoom);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => {
      setZoom(calcZoom());
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return { zoom, isMobile };
}

export function App() {
  const randomAuthor = useMemo(
    () => `Docx Editor User ${Math.floor(Math.random() * 900) + 100}`,
    []
  );
  const editorRef = useRef<DocxEditorRef>(null);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('docx-editor-demo.docx');
  const [status, setStatus] = useState<string>('');
  const [selectedVariable, setSelectedVariable] = useState<ClickedVariable | null>(null);

  // ?flagOff=1 in the URL disables the modal feature gate — used by E2E to
  // verify that clicks fall back to the default cursor-selection behavior.
  const enableVariableModal = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return !new URLSearchParams(window.location.search).has('flagOff');
  }, []);

  const templatePluginInstance = useMemo(
    () =>
      createTemplatePlugin({
        enableVariableModal,
        onVariableClick: setSelectedVariable,
      }),
    [enableVariableModal]
  );

  const { zoom: autoZoom, isMobile } = useResponsiveLayout();

  useEffect(() => {
    fetch('/docx-editor-demo.docx')
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        setDocumentBuffer(buffer);
        setFileName('docx-editor-demo.docx');
      })
      .catch(() => {
        setCurrentDocument(createEmptyDocument());
        setFileName('Untitled.docx');
      });
  }, []);

  const handleNewDocument = useCallback(() => {
    setCurrentDocument(createEmptyDocument());
    setDocumentBuffer(null);
    setFileName('Untitled.docx');
    setStatus('');
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus('Loading...');
      const buffer = await file.arrayBuffer();
      setCurrentDocument(null);
      setDocumentBuffer(buffer);
      setFileName(file.name);
      setStatus('');
    } catch {
      setStatus('Error loading file');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!editorRef.current) return;

    try {
      setStatus('Saving...');
      const buffer = await editorRef.current.save();
      if (buffer) {
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'document.docx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus('Saved!');
        setTimeout(() => setStatus(''), 2000);
      }
    } catch {
      setStatus('Save failed');
    }
  }, [fileName]);

  const handleError = useCallback((error: Error) => {
    console.error('Editor error:', error);
    setStatus(`Error: ${error.message}`);
  }, []);

  const handleFontsLoaded = useCallback(() => {
    console.log('Fonts loaded');
  }, []);

  const renderLogo = useCallback(
    () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <GitHubBadge />
        <ExampleSwitcher current="Vite" />
      </div>
    ),
    []
  );

  const renderTitleBarRight = useCallback(
    () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={styles.fileInputLabel} onMouseDown={(e) => e.stopPropagation()}>
          <input
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          Open DOCX
        </label>
        <button style={styles.newButton} onClick={handleNewDocument}>
          New
        </button>
        <button style={styles.button} onClick={handleSave}>
          Save
        </button>
        {status && <span style={styles.status}>{status}</span>}
      </div>
    ),
    [handleFileSelect, handleNewDocument, handleSave, status]
  );

  return (
    <div style={styles.container}>
      <main style={styles.main}>
        <PluginHost plugins={[templatePluginInstance]}>
          <DocxEditor
            ref={editorRef}
            document={documentBuffer ? undefined : currentDocument}
            documentBuffer={documentBuffer}
            author={randomAuthor}
            onError={handleError}
            onFontsLoaded={handleFontsLoaded}
            showToolbar={true}
            showRuler={!isMobile}
            showZoomControl={true}
            initialZoom={autoZoom}
            renderLogo={renderLogo}
            documentName={fileName}
            onDocumentNameChange={setFileName}
            renderTitleBarRight={renderTitleBarRight}
          />
        </PluginHost>
      </main>
      {selectedVariable && (
        <div
          data-testid="template-variable-modal"
          onClick={() => setSelectedVariable(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '28px 32px',
              minWidth: 380,
              maxWidth: 520,
              boxShadow: '0 24px 48px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(139, 92, 246, 0.15)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#7c3aed',
                marginBottom: 8,
              }}
            >
              Template Variable
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              {selectedVariable.name}
            </h2>
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 13,
                color: '#475569',
              }}
            >
              {selectedVariable.rawTag}
            </div>
            <div style={{ marginTop: 20, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              In the VanHorn integration, this modal would render the BE-driven{' '}
              <code style={{ fontSize: 12, color: '#0f172a' }}>AwaitingInputModal</code> for{' '}
              <strong>{selectedVariable.name}</strong> — pulling its field spec, type, and
              validation from the template_spec.
            </div>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setSelectedVariable(null)}
                style={{
                  padding: '8px 18px',
                  background: 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%)',
                  color: '#ffffff',
                  border: '1px solid #6d28d9',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow:
                    '0 1px 2px rgba(76, 29, 149, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
