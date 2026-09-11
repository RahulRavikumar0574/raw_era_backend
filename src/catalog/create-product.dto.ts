export interface CreateProductDto {
  name: string;
  description?: string;
  shortDescription?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  sku?: string;
  brand?: string;
  categoryId: string;
  stock?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  images?: { url: string; alt?: string; isPrimary?: boolean; order?: number }[];
  variants?: {
    name: string;
    type: 'SIZE' | 'COLOR' | 'MATERIAL' | 'STYLE';
    value: string;
    price?: number;
    stock?: number;
    sku?: string;
  }[];
  specifications?: { name: string; value: string; group?: string }[];
  tags?: string[];
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}
