// frontend/pages/register.tsx
import Head from 'next/head';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link'; // Importa o componente Link

export default function Register() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('https://assistente-estudo-inteligente-backend.onrender.com/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha no registro.');
      }

      const data = await response.json();
      setSuccessMessage(data.message || 'Registro bem-sucedido!');
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      if (data.userId) {
        localStorage.setItem('userId', data.userId);
      }

      setTimeout(() => {
        router.push('/');
      }, 1500);

    } catch (err: unknown) { // Tipo 'unknown' para erros
      console.error("Erro no registro:", err);
      let errorMessage = 'Ocorreu um erro no registro.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage || 'Ocorreu um erro no registro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Head>
        <title>Registrar | Assistente de Estudo</title>
      </Head>

      <main className="auth-card">
        <h1>Registrar</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirmar Senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Registrando...' : 'Registrar'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <p className="auth-link">
          Já tem uma conta? <Link href="/login"><a>Faça Login</a></Link>
        </p>
      </main>
    </div>
  );
}