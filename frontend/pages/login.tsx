// frontend/pages/login.tsx
import Head from 'next/head';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router'; // Importa o useRouter para redirecionamento

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter(); // Instancia o roteador

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault(); // Previne o comportamento padrão de recarregar a página

    setError(null); // Limpa erros anteriores
    setSuccessMessage(null); // Limpa mensagens de sucesso anteriores
    setIsLoading(true); // Ativa o estado de carregamento

    try {
      // Faz a requisição POST para a rota de login no seu Back-end
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // Indica que o corpo da requisição é JSON
        },
        body: JSON.stringify({ email, password }), // Converte os dados do formulário para JSON
      });

      // Verifica se a resposta do servidor foi bem-sucedida
      if (!response.ok) {
        const errorData = await response.json(); // Pega a mensagem de erro do corpo da resposta
        throw new Error(errorData.error || 'Falha no login.');
      }

      const data = await response.json(); // Pega os dados de sucesso (incluindo token e userId)
      setSuccessMessage(data.message || 'Login bem-sucedido!');
      
      // Salva o token e userId no localStorage para manter o usuário logado
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      if (data.userId) {
        localStorage.setItem('userId', data.userId);
      }

      // Redireciona para a página principal após um pequeno atraso para feedback visual
      setTimeout(() => {
        router.push('/');
      }, 1500);

    } catch (err: any) { // Captura erros da requisição
      console.error("Erro no login:", err);
      setError(err.message || 'Ocorreu um erro no login.');
    } finally {
      setIsLoading(false); // Desativa o estado de carregamento
    }
  };

  return (
    <div className="auth-container"> {/* Aplica classe CSS de container de autenticação */}
      <Head>
        <title>Login | Assistente de Estudo</title>
      </Head>

      <main className="auth-card"> {/* Aplica classe CSS de card de autenticação */}
        <h1>Login</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required // Campo obrigatório
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required // Campo obrigatório
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'} {/* Texto dinâmico do botão */}
          </button>
        </form>

        {/* Exibe mensagens de erro ou sucesso */}
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <p className="auth-link">
          Não tem uma conta? <a href="/register">Registre-se</a> {/* Link para a página de registro */}
        </p>
      </main>
    </div>
  );
}