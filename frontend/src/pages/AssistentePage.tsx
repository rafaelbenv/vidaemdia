import React from 'react';
import { MessageSquare, Send, RefreshCw } from 'lucide-react';
import { ChatMessage } from '../types';
import { sanitizeTelegramHtml } from '../lib/format';
import { TechTag } from '../components/TechTag';

export interface AssistentePageProps {
  chatHistory: ChatMessage[];
  setBotInput: (val: string) => void;
  botInput: string;
  handleSendBotMessage: (e: React.FormEvent) => Promise<void>;
  submitting: Record<string, boolean>;
}

export function AssistentePage({
  chatHistory,
  setBotInput,
  botInput,
  handleSendBotMessage,
  submitting,
}: AssistentePageProps) {
  return (
    <div role="tabpanel" id="tabpanel-chatbot" aria-labelledby="tab-chatbot">
      <div className="max-w-3xl mx-auto bg-white rounded-lg border border-stone-200 overflow-hidden">
        <div className="bg-brand-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6" />
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                Assistente VidaEmDia
                <TechTag>Chatbot Telegram (Webhook)</TechTag>
              </h2>
              <p className="text-xs text-white/90">
                Envie uma mensagem para criar ou consultar eventos na sua agenda automaticamente
              </p>
            </div>
          </div>
        </div>

        {/* Histórico de Mensagens */}
        <div className="p-5 bg-stone-100 max-h-[60vh] sm:h-96 overflow-y-auto space-y-3">
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500">
              <MessageSquare className="w-8 h-8 text-stone-400 mb-2" />
              <p className="text-sm font-semibold text-stone-700">Histórico do chat vazio</p>
              <p className="text-xs text-stone-500 mt-1 max-w-sm">
                Nenhuma mensagem trocada ainda. Envie uma mensagem pelo campo abaixo ou use um dos exemplos rápidos para interagir com o bot.
              </p>
            </div>
          ) : (
            chatHistory.map((item, idx) => (
              <div
                key={idx}
                className={`flex ${item.sender === 'USER' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md p-3.5 rounded-lg text-xs ${
                    item.sender === 'USER'
                      ? 'bg-brand-700 text-white rounded-br-none'
                      : 'bg-white text-stone-800 border border-stone-200 rounded-bl-none'
                  }`}
                >
                  {item.sender === 'USER' ? (
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed text-xs">{item.text}</pre>
                  ) : (
                    <div
                      className="whitespace-pre-wrap font-sans leading-relaxed text-xs"
                      dangerouslySetInnerHTML={{ __html: sanitizeTelegramHtml(item.text) }}
                    />
                  )}
                  <div
                    className={`text-xs mt-1 text-right font-mono text-[11px] tabular-nums ${
                      item.sender === 'USER' ? 'text-white/90' : 'text-stone-500'
                    }`}
                  >
                    {item.time}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sugestões Rápidas */}
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-stone-500 font-semibold">Exemplos rápidos:</span>
          <button
            type="button"
            onClick={() => setBotInput('agenda')}
            className="text-xs px-2.5 py-1 bg-white border border-stone-300 rounded-md hover:bg-stone-100 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
          >
            "agenda"
          </button>
          <button
            type="button"
            onClick={() => setBotInput('Marcar Consulta médica hoje às 08:00')}
            className="text-xs px-2.5 py-1 bg-white border border-stone-300 rounded-md hover:bg-stone-100 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
          >
            "Marcar Consulta médica hoje às 08:00"
          </button>
          <button
            type="button"
            onClick={() => setBotInput('Agendar Reunião de Alinhamento amanhã às 15:00')}
            className="text-xs px-2.5 py-1 bg-white border border-stone-300 rounded-md hover:bg-stone-100 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center"
          >
            "Agendar Reunião de Alinhamento amanhã às 15:00"
          </button>
        </div>

        {/* Input do Chat */}
        <form
          onSubmit={handleSendBotMessage}
          className="p-4 bg-white border-t border-stone-200 flex gap-2"
        >
          <label htmlFor="bot-input" className="sr-only">
            Mensagem para o assistente
          </label>
          <input
            id="bot-input"
            type="text"
            value={botInput}
            onChange={(e) => setBotInput(e.target.value)}
            placeholder="Ex.: Marcar Consulta médica hoje às 08:00"
            className="flex-1 px-4 py-2.5 text-base border border-stone-300 rounded-md focus:ring-2 focus:ring-brand-700 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting['chat']}
            className="px-5 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md flex items-center justify-center gap-1.5 transition min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
          >
            {submitting['chat'] ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
