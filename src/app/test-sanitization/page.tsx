"use client";

import { useState } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestSanitizationPage() {
  const [input, setInput] = useState("");
  const [sanitized, setSanitized] = useState("");

  const sanitize = (text: string) => {
    if (typeof window === 'undefined') return text;
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  };

  const handleTest = () => {
    setSanitized(sanitize(input));
  };

  return (
    <div className="p-8 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Teste de Sanitização XSS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Input com script malicioso:</p>
            <Input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Cole algo como <script>alert('XSS')</script> aqui"
            />
          </div>
          
          <Button onClick={handleTest}>Testar Sanitização</Button>

          {sanitized && (
            <div className="space-y-2 pt-4">
              <p className="text-sm font-medium">Resultado Sanitizado (Deve estar limpo):</p>
              <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
                {sanitized || "(Vazio - Significa que tudo foi removido)"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="text-sm text-muted-foreground">
        <p>Exemplos para testar:</p>
        <ul className="list-disc pl-5 mt-2">
          <li><code>&lt;script&gt;alert(&quot;Hack!&quot;)&lt;/script&gt;</code></li>
          <li><code>&lt;img src=x onerror=alert(1)&gt;</code></li>
          <li><code>&lt;b&gt;Texto em negrito deve sumir&lt;/b&gt;</code> (Pois configuramos ALLOWED_TAGS: [])</li>
        </ul>
      </div>
    </div>
  );
}

