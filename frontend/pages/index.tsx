// frontend/pages/index.tsx
import Head from 'next/head';
import { useState, FormEvent, useEffect, useCallback } from 'react'; // Importa useCallback
import { useRouter } from 'next/router';
import Link from 'next/link'; // Importa o componente Link

// Interface para tipar os flashcards
interface Flashcard {
  id: string;
  pergunta: string;
  resposta: string;
  isFlipped: boolean;
  createdAt?: string; // Adicionado para flashcards do banco de dados (terão timestamp)
}

export default function Home() {
  const router = useRouter();
  const [textInput, setTextInput] = useState<string>('');
  const [generatedFlashcards, setGeneratedFlashcards] = useState<Flashcard[]>([]);
  const [savedFlashcards, setSavedFlashcards] = useState<Flashcard[]>([]);
  const [isLoadingGenerate, setIsLoadingGenerate] = useState<boolean>(false);
  const [isLoadingSave, setIsLoadingSave] = useState<boolean>(false);
  const [isLoadingFetch, setIsLoadingFetch] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Função para buscar flashcards salvos, agora envolvida em useCallback
  const fetchSavedFlashcards = useCallback(async (token: string) => {
    setIsLoadingFetch(true);
    setError(null);
    try {
      const response = await fetch('https://assistente-estudo-inteligente-backend.onrender.com/api/flashcards', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
              localStorage.removeItem('token');
              localStorage.removeItem('userId');
              setIsLoggedIn(false);
              router.push('/login');
              throw new Error('Sessão expirada ou inválida. Por favor, faça login novamente.');
          }
        throw new Error('Falha ao carregar flashcards salvos.');
      }
      const data: Flashcard[] = await response.json();
      const flashcardsWithFlipState = data.map(card => ({ ...card, isFlipped: false }));
      setSavedFlashcards(flashcardsWithFlipState);
    } catch (err: unknown) {
      console.error("Erro ao carregar flashcards salvos:", err);
      let errorMessage = 'Ocorreu um erro ao carregar flashcards salvos.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(`Erro: ${errorMessage}. Verifique o console para mais detalhes.`);
    } finally {
      setIsLoadingFetch(false);
    }
  }, [router]); // router é uma dependência de useCallback

  // useEffect para verificar o token no localStorage e carregar flashcards salvos
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      setAuthToken(token);
      fetchSavedFlashcards(token); // Chama a função para buscar flashcards com o token
    } else {
      setIsLoggedIn(false);
    }
  }, [fetchSavedFlashcards]); // fetchSavedFlashcards agora é uma dependência

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isLoggedIn) {
        setError('Você precisa estar logado para gerar e salvar flashcards.');
        return;
    }

    if (!textInput.trim()) {
      setError('Por favor, insira algum texto para gerar os flashcards.');
      return;
    }

    setIsLoadingGenerate(true);
    setError(null);
    setSuccessMessage(null);
    setGeneratedFlashcards([]);

    try {
      const response = await fetch('https://assistente-estudo-inteligente-backend.onrender.com/api/generate-flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ text: textInput }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Falha ao gerar flashcards. Tente novamente.');
      }

      const data: Omit<Flashcard, 'id' | 'isFlipped' | 'createdAt'>[] = await response.json();
      const flashcardsWithIds = data.map(card => ({
        ...card,
        id: Math.random().toString(36).substring(2, 11),
        isFlipped: false
      }));
      setGeneratedFlashcards(flashcardsWithIds);
    } catch (err: unknown) { // Tipo 'unknown' para erros
      console.error("Erro ao gerar flashcards:", err);
      let errorMessage = 'Ocorreu um erro desconhecido ao gerar.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(`Erro: ${errorMessage}. Verifique o console para mais detalhes.`);
    } finally {
      setIsLoadingGenerate(false);
    }
  };

  const handleSaveFlashcards = async () => {
    if (!isLoggedIn || !authToken) {
        setError('Você precisa estar logado para salvar flashcards.');
        return;
    }

    if (generatedFlashcards.length === 0) {
      setError('Não há flashcards para salvar. Gere alguns primeiro!');
      return;
    }

    setIsLoadingSave(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('https://assistente-estudo-inteligente-backend.onrender.com/api/flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ flashcards: generatedFlashcards }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao salvar flashcards.');
      }

      setSuccessMessage('Flashcard(s) salvo(s) com sucesso!');
      setGeneratedFlashcards([]);
      fetchSavedFlashcards(authToken);

    } catch (err: unknown) { // Tipo 'unknown' para erros
      console.error("Erro ao salvar flashcards:", err);
      let errorMessage = 'Ocorreu um erro desconhecido ao salvar.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(`Erro: ${errorMessage}. Verifique o console para mais detalhes.`);
    } finally {
      setIsLoadingSave(false);
    }
  };

  const handleFlip = (id: string, type: 'generated' | 'saved') => {
    if (type === 'generated') {
      setGeneratedFlashcards(prevCards =>
        prevCards.map(card =>
          card.id === id ? { ...card, isFlipped: !card.isFlipped } : card
        )
      );
    } else {
      setSavedFlashcards(prevCards =>
        prevCards.map(card =>
          card.id === id ? { ...card, isFlipped: !card.isFlipped } : card
        )
      );
    }
  };

  const handleDelete = async (id: string, type: 'generated' | 'saved') => {
    if (!isLoggedIn || !authToken) {
        setError('Você precisa estar logado para deletar flashcards.');
        return;
    }

    if (type === 'generated') {
      setGeneratedFlashcards(prevCards => prevCards.filter(card => card.id !== id));
    } else {
      try {
        const response = await fetch(`https://assistente-estudo-inteligente-backend.onrender.com/api/flashcards/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                setIsLoggedIn(false);
                router.push('/login');
                throw new Error('Sessão expirada ou inválida. Por favor, faça login novamente.');
            }
          throw new Error('Falha ao deletar flashcard do banco.');
        }
        setSavedFlashcards(prevCards => prevCards.filter(card => card.id !== id));
        setSuccessMessage('Flashcard deletado do banco com sucesso!');
      } catch (err: unknown) { // Tipo 'unknown' para erros
        console.error("Erro ao deletar flashcard do banco:", err);
        let errorMessage = 'Ocorreu um erro ao deletar do banco.';
        if (err instanceof Error) {
          errorMessage = err.message;
        }
        setError(`Erro: ${errorMessage}.`);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setIsLoggedIn(false);
    setAuthToken(null);
    setSavedFlashcards([]);
    setGeneratedFlashcards([]);
    setSuccessMessage('Você foi desconectado.');
    setError(null);
    router.push('/login');
  };

  return (
    <div className="main-wrapper">
      <Head>
        <title>Assistente de Estudo Inteligente</title>
        <meta name="description" content="Gere flashcards de forma inteligente com IA" />
        <link rel="icon" href="/favicon.ico" />
        {/* Removido o link para Google Fonts daqui, ele agora está em _document.tsx */}
      </Head>

      <main className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1>📚 Assistente de Estudo Inteligente</h1>
          {isLoggedIn && (
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid #dc3545',
                color: '#dc3545',
                padding: '8px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.9em',
                fontWeight: '600',
                transition: 'background-color 0.2s, color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#dc3545', e.currentTarget.style.color = '#fff')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'none', e.currentTarget.style.color = '#dc3545')}
            >
              Sair
            </button>
          )}
        </div>
        <p>Cole seu texto abaixo e deixe a IA gerar flashcards para você!</p>

        {!isLoggedIn && (
            <div className="error-message" style={{backgroundColor: '#fff3cd', borderColor: '#ffeeba', color: '#856404'}}>
                <p>Você precisa <Link href="/login"><a>fazer login</a></Link> ou <Link href="/register"><a>registrar-se</a></Link> para usar o assistente.</p>
            </div>
        )}

        {isLoggedIn && (
            <> {/* Fragmento para agrupar o formulário e as seções */}
                <form onSubmit={handleSubmit}>
                <textarea
                    placeholder="Cole seu artigo, resumo ou notas de aula aqui..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                ></textarea>
                <button
                    type="submit"
                    disabled={isLoadingGenerate}
                >
                    {isLoadingGenerate ? 'Gerando Flashcards...' : 'Gerar Flashcards com IA'}
                </button>
                </form>

                {error && (
                <div className="error-message">
                    <p className="font-semibold">Ocorreu um erro:</p>
                    <p>{error}</p>
                </div>
                )}

                {successMessage && (
                <div className="success-message">
                    <p>{successMessage}</p>
                </div>
                )}

                {/* Seção para Flashcards Gerados */}
                {generatedFlashcards.length > 0 && (
                <div>
                    <h2>Flashcards Gerados (Temporários):</h2>
                    <div className="flashcards-grid">
                    {generatedFlashcards.map((card) => (
                        <div
                        key={card.id}
                        className={`flashcard-item-container ${card.isFlipped ? 'is-flipped' : ''}`}
                        onClick={() => handleFlip(card.id, 'generated')}
                        >
                        <button
                            onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(card.id, 'generated');
                            }}
                            className="delete-button"
                        >
                            &times;
                        </button>
                        <div className="flashcard-face flashcard-front">
                            <h3>P:</h3>
                            <p>{card.pergunta}</p>
                        </div>
                        <div className="flashcard-face flashcard-back">
                            <h3>R:</h3>
                            <p>{card.resposta}</p>
                        </div>
                        </div>
                    ))}
                    </div>
                    <button
                    onClick={handleSaveFlashcards}
                    disabled={isLoadingSave || generatedFlashcards.length === 0}
                    style={{marginTop: '30px', backgroundColor: '#28a745', boxShadow: '0 4px 10px rgba(40, 167, 69, 0.2)'}}
                    >
                    {isLoadingSave ? 'Salvando...' : 'Salvar Flashcards Gerados'}
                    </button>
                </div>
                )}

                {/* Seção para Flashcards Salvos */}
                {savedFlashcards.length > 0 && (
                <div>
                    <h2>Flashcards Salvos:</h2>
                    {isLoadingFetch && <p style={{textAlign: 'center'}}>Carregando flashcards salvos...</p>}
                    <div className="flashcards-grid">
                    {savedFlashcards.map((card) => (
                        <div
                        key={card.id}
                        className={`flashcard-item-container ${card.isFlipped ? 'is-flipped' : ''}`}
                        onClick={() => handleFlip(card.id, 'saved')}
                        >
                        <button
                            onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(card.id, 'saved');
                            }}
                            className="delete-button"
                        >
                            &times;
                        </button>
                        <div className="flashcard-face flashcard-front">
                            <h3>P:</h3>
                            <p>{card.pergunta}</p>
                        </div>
                        <div className="flashcard-face flashcard-back">
                            <h3>R:</h3>
                            <p>{card.resposta}</p>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                )}

                {/* Mensagem se não houver flashcards salvos */}
                {savedFlashcards.length === 0 && !isLoadingFetch && generatedFlashcards.length === 0 && (
                    <p style={{textAlign: 'center', marginTop: '30px', color: '#666'}}>Nenhum flashcard salvo ainda. Gere alguns e salve-os!</p>
                )}

                {/* Mensagem de carregamento inicial */}
                {isLoadingFetch && savedFlashcards.length === 0 && (
                    <p style={{textAlign: 'center', marginTop: '30px'}}>Carregando flashcards salvos...</p>
                )}
            </>
        )}
      </main>

      <footer>
        Desenvolvido por Portfoliator™ com React, Next.js, Google Gemini e Supabase.
      </footer>
    </div>
  );
}