import api from './client';
import type { MarketplaceItem, MarketplaceUseResponse } from '../lib/types';

export async function listMarketplaceItems(params?: {
  item_type?: string;
  category?: string;
  search?: string;
}) {
  const res = await api.get('/marketplace', { params });
  return res.data as MarketplaceItem[];
}

export async function getMarketplaceItem(itemId: string) {
  const res = await api.get(`/marketplace/${itemId}`);
  return res.data as MarketplaceItem;
}

export async function useMarketplaceItem(
  itemId: string,
  data?: { folder_id?: string; file_id?: string }
) {
  const res = await api.post(`/marketplace/${itemId}/use`, data || {});
  return res.data as MarketplaceUseResponse;
}

export async function listMyMarketplaceItems(params?: {
  item_type?: string;
}) {
  const res = await api.get('/marketplace/mine', { params });
  return res.data as MarketplaceItem[];
}

export async function createMarketplaceItem(data: {
  item_type: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  content?: string;
}) {
  const res = await api.post('/marketplace', data);
  return res.data as MarketplaceItem;
}

export async function submitToMarketplace(itemId: string) {
  const res = await api.post(`/marketplace/${itemId}/submit`);
  return res.data as MarketplaceItem;
}
