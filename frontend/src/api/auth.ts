import api from './client';
import type { User } from '../lib/types';

export async function register(email: string, password: string, displayName: string) {
  const res = await api.post('/auth/register', {
    email,
    password,
    display_name: displayName,
  });
  return res.data as User;
}

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password });
  return res.data as { access_token: string; refresh_token: string };
}

export async function getMe() {
  const res = await api.get('/users/me');
  return res.data as User;
}

export async function updateMe(data: { display_name?: string; anthropic_api_key?: string }) {
  const res = await api.patch('/users/me', data);
  return res.data as User;
}
