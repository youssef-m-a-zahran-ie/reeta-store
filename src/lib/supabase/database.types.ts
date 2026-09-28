// Generated from the Supabase schema. Regenerate after migrations.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abandoned_checkouts: {
        Row: {
          cart: Json
          contacted: boolean
          created_at: string
          id: string
          name: string | null
          phone: string
          recovered_order_id: string | null
          subtotal: number | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          cart?: Json
          contacted?: boolean
          created_at?: string
          id?: string
          name?: string | null
          phone: string
          recovered_order_id?: string | null
          subtotal?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          cart?: Json
          contacted?: boolean
          created_at?: string
          id?: string
          name?: string | null
          phone?: string
          recovered_order_id?: string | null
          subtotal?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_checkouts_recovered_order_id_fkey"
            columns: ["recovered_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_spend: {
        Row: {
          amount: number
          campaign: string | null
          created_at: string
          id: string
          note: string | null
          period_end: string
          period_start: string
          platform: Database["public"]["Enums"]["ad_platform"]
        }
        Insert: {
          amount: number
          campaign?: string | null
          created_at?: string
          id?: string
          note?: string | null
          period_end: string
          period_start: string
          platform: Database["public"]["Enums"]["ad_platform"]
        }
        Update: {
          amount?: number
          campaign?: string | null
          created_at?: string
          id?: string
          note?: string | null
          period_end?: string
          period_start?: string
          platform?: Database["public"]["Enums"]["ad_platform"]
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      bases: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          slug: string
          sort: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          slug: string
          sort?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      box_config_products: {
        Row: {
          box_config_id: string
          product_id: string
        }
        Insert: {
          box_config_id: string
          product_id: string
        }
        Update: {
          box_config_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_config_products_box_config_id_fkey"
            columns: ["box_config_id"]
            isOneToOne: false
            referencedRelation: "box_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "box_config_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      box_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          option_value_id: string | null
          price: number | null
          slots: number
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          option_value_id?: string | null
          price?: number | null
          slots: number
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          option_value_id?: string | null
          price?: number | null
          slots?: number
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_configs_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "option_values"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_images: {
        Row: {
          alt_ar: string | null
          alt_en: string | null
          bundle_id: string
          created_at: string
          id: string
          path: string
          sort: number
        }
        Insert: {
          alt_ar?: string | null
          alt_en?: string | null
          bundle_id: string
          created_at?: string
          id?: string
          path: string
          sort?: number
        }
        Update: {
          alt_ar?: string | null
          alt_en?: string | null
          bundle_id?: string
          created_at?: string
          id?: string
          path?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_images_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          bundle_id: string
          id: string
          qty: number
          variant_id: string
        }
        Insert: {
          bundle_id: string
          id?: string
          qty?: number
          variant_id: string
        }
        Update: {
          bundle_id?: string
          id?: string
          qty?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_prices"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "bundle_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          name_ar: string
          name_en: string
          price: number
          slug: string
          sort: number
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar: string
          name_en: string
          price: number
          slug: string
          sort?: number
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          price?: number
          slug?: string
          sort?: number
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          image_path: string | null
          is_visible: boolean
          name_ar: string
          name_en: string
          slug: string
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_path?: string | null
          is_visible?: boolean
          name_ar: string
          name_en: string
          slug: string
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_path?: string | null
          is_visible?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      coatings: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          slug: string
          sort: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          slug: string
          sort?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          slug?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_blocks: {
        Row: {
          data: Json
          is_visible: boolean
          key: string
          page: string
          sort: number
          updated_at: string
        }
        Insert: {
          data?: Json
          is_visible?: boolean
          key: string
          page?: string
          sort?: number
          updated_at?: string
        }
        Update: {
          data?: Json
          is_visible?: boolean
          key?: string
          page?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          flagged: boolean
          id: string
          name: string | null
          notes: string | null
          phone: string
          refused_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          flagged?: boolean
          id?: string
          name?: string | null
          notes?: string | null
          phone: string
          refused_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          flagged?: boolean
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string
          refused_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      discounts: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          min_subtotal: number
          product_ids: string[] | null
          starts_at: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal?: number
          product_ids?: string[] | null
          starts_at?: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal?: number
          product_ids?: string[] | null
          starts_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer_ar: string
          answer_en: string
          created_at: string
          id: string
          is_visible: boolean
          question_ar: string
          question_en: string
          sort: number
        }
        Insert: {
          answer_ar: string
          answer_en: string
          created_at?: string
          id?: string
          is_visible?: boolean
          question_ar: string
          question_en: string
          sort?: number
        }
        Update: {
          answer_ar?: string
          answer_en?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          question_ar?: string
          question_en?: string
          sort?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          email: string | null
          id: string
          is_read: boolean
          lang: string
          name: string
          phone: string | null
          replied_at: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email?: string | null
          id?: string
          is_read?: boolean
          lang?: string
          name: string
          phone?: string | null
          replied_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email?: string | null
          id?: string
          is_read?: boolean
          lang?: string
          name?: string
          phone?: string | null
          replied_at?: string | null
        }
        Relationships: []
      }
      option_types: {
        Row: {
          created_at: string
          id: string
          name_ar: string
          name_en: string
          slug: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_ar: string
          name_en: string
          slug: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string
          slug?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      option_values: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          label_ar: string
          label_en: string
          option_type_id: string
          sort: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          label_ar: string
          label_en: string
          option_type_id: string
          sort?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          label_ar?: string
          label_en?: string
          option_type_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_values_option_type_id_fkey"
            columns: ["option_type_id"]
            isOneToOne: false
            referencedRelation: "option_types"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          created_by: string | null
          from_value: string | null
          id: string
          note: string | null
          order_id: string
          to_value: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_value?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_value?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_value?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_value?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          bundle_id: string | null
          grams: number | null
          id: string
          line_total: number
          name_ar: string
          name_en: string
          option_label: string | null
          order_id: string
          product_id: string | null
          qty: number
          unit_cost: number | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          bundle_id?: string | null
          grams?: number | null
          id?: string
          line_total: number
          name_ar: string
          name_en: string
          option_label?: string | null
          order_id: string
          product_id?: string | null
          qty: number
          unit_cost?: number | null
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          bundle_id?: string | null
          grams?: number | null
          id?: string
          line_total?: number
          name_ar?: string
          name_en?: string
          option_label?: string | null
          order_id?: string
          product_id?: string | null
          qty?: number
          unit_cost?: number | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_prices"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_line: string
          apartment: string | null
          building: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_note: string | null
          delivered_at: string | null
          discount_code: string | null
          discount_id: string | null
          discount_total: number
          distance_km: number | null
          distance_method: string | null
          floor: string | null
          id: string
          internal_note: string | null
          landmark: string | null
          lang: string
          lat: number | null
          lng: number | null
          number: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          referrer: string | null
          shipping_fee: number
          source: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          address_line: string
          apartment?: string | null
          building?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_note?: string | null
          delivered_at?: string | null
          discount_code?: string | null
          discount_id?: string | null
          discount_total?: number
          distance_km?: number | null
          distance_method?: string | null
          floor?: string | null
          id?: string
          internal_note?: string | null
          landmark?: string | null
          lang?: string
          lat?: number | null
          lng?: number | null
          number?: never
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          referrer?: string | null
          shipping_fee?: number
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          address_line?: string
          apartment?: string | null
          building?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_note?: string | null
          delivered_at?: string | null
          discount_code?: string | null
          discount_id?: string | null
          discount_total?: number
          distance_km?: number | null
          distance_method?: string | null
          floor?: string | null
          id?: string
          internal_note?: string | null
          landmark?: string | null
          lang?: string
          lat?: number | null
          lng?: number | null
          number?: never
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          referrer?: string | null
          shipping_fee?: number
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          body_ar: string
          body_en: string
          is_published: boolean
          slug: string
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          body_ar?: string
          body_en?: string
          is_published?: boolean
          slug: string
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          body_ar?: string
          body_en?: string
          is_published?: boolean
          slug?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_template_items: {
        Row: {
          cost: number | null
          option_value_id: string
          price: number | null
          template_id: string
        }
        Insert: {
          cost?: number | null
          option_value_id: string
          price?: number | null
          template_id: string
        }
        Update: {
          cost?: number | null
          option_value_id?: string
          price?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_template_items_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "price_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      price_templates: {
        Row: {
          base_id: string | null
          created_at: string
          id: string
          name: string
          option_type_id: string
          updated_at: string
        }
        Insert: {
          base_id?: string | null
          created_at?: string
          id?: string
          name: string
          option_type_id: string
          updated_at?: string
        }
        Update: {
          base_id?: string | null
          created_at?: string
          id?: string
          name?: string
          option_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_templates_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_templates_option_type_id_fkey"
            columns: ["option_type_id"]
            isOneToOne: false
            referencedRelation: "option_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_ar: string | null
          alt_en: string | null
          created_at: string
          id: string
          path: string
          product_id: string
          sort: number
        }
        Insert: {
          alt_ar?: string | null
          alt_en?: string | null
          created_at?: string
          id?: string
          path: string
          product_id: string
          sort?: number
        }
        Update: {
          alt_ar?: string | null
          alt_en?: string | null
          created_at?: string
          id?: string
          path?: string
          product_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allergens_ar: string | null
          allergens_en: string | null
          base_id: string | null
          category_id: string
          coating_id: string | null
          color: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          ingredients_ar: string | null
          ingredients_en: string | null
          is_featured: boolean
          low_stock_threshold: number
          name_ar: string
          name_en: string
          option_type_id: string | null
          price_template_id: string | null
          seo_description: string | null
          seo_title: string | null
          short_ar: string | null
          short_en: string | null
          slug: string
          sort: number
          status: Database["public"]["Enums"]["product_status"]
          stock_grams: number
          stock_unit: Database["public"]["Enums"]["stock_unit"]
          storage_ar: string | null
          storage_en: string | null
          updated_at: string
        }
        Insert: {
          allergens_ar?: string | null
          allergens_en?: string | null
          base_id?: string | null
          category_id: string
          coating_id?: string | null
          color?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          ingredients_ar?: string | null
          ingredients_en?: string | null
          is_featured?: boolean
          low_stock_threshold?: number
          name_ar: string
          name_en: string
          option_type_id?: string | null
          price_template_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_ar?: string | null
          short_en?: string | null
          slug: string
          sort?: number
          status?: Database["public"]["Enums"]["product_status"]
          stock_grams?: number
          stock_unit?: Database["public"]["Enums"]["stock_unit"]
          storage_ar?: string | null
          storage_en?: string | null
          updated_at?: string
        }
        Update: {
          allergens_ar?: string | null
          allergens_en?: string | null
          base_id?: string | null
          category_id?: string
          coating_id?: string | null
          color?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          ingredients_ar?: string | null
          ingredients_en?: string | null
          is_featured?: boolean
          low_stock_threshold?: number
          name_ar?: string
          name_en?: string
          option_type_id?: string | null
          price_template_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_ar?: string | null
          short_en?: string | null
          slug?: string
          sort?: number
          status?: Database["public"]["Enums"]["product_status"]
          stock_grams?: number
          stock_unit?: Database["public"]["Enums"]["stock_unit"]
          storage_ar?: string | null
          storage_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_coating_id_fkey"
            columns: ["coating_id"]
            isOneToOne: false
            referencedRelation: "coatings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_option_type_id_fkey"
            columns: ["option_type_id"]
            isOneToOne: false
            referencedRelation: "option_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_price_template_id_fkey"
            columns: ["price_template_id"]
            isOneToOne: false
            referencedRelation: "price_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          announcement_ar: string | null
          announcement_en: string | null
          announcement_visible: boolean
          build_box_enabled: boolean
          distance_factor: number
          facebook_url: string | null
          fee_per_km: number | null
          fee_round_to: number
          ga4_id: string | null
          id: number
          instagram_url: string | null
          instapay_handle: string | null
          instapay_link: string | null
          instapay_name: string | null
          meta_pixel_id: string | null
          min_shipping_fee: number
          notify_emails: string[]
          orders_paused: boolean
          paused_message_ar: string | null
          paused_message_en: string | null
          seo_description: string | null
          seo_title: string | null
          site_url: string
          store_address: string | null
          store_lat: number | null
          store_lng: number | null
          tiktok_pixel_id: string | null
          tiktok_url: string | null
          updated_at: string
          whatsapp_button: boolean
          whatsapp_number: string | null
        }
        Insert: {
          announcement_ar?: string | null
          announcement_en?: string | null
          announcement_visible?: boolean
          build_box_enabled?: boolean
          distance_factor?: number
          facebook_url?: string | null
          fee_per_km?: number | null
          fee_round_to?: number
          ga4_id?: string | null
          id?: number
          instagram_url?: string | null
          instapay_handle?: string | null
          instapay_link?: string | null
          instapay_name?: string | null
          meta_pixel_id?: string | null
          min_shipping_fee?: number
          notify_emails?: string[]
          orders_paused?: boolean
          paused_message_ar?: string | null
          paused_message_en?: string | null
          seo_description?: string | null
          seo_title?: string | null
          site_url?: string
          store_address?: string | null
          store_lat?: number | null
          store_lng?: number | null
          tiktok_pixel_id?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_button?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          announcement_ar?: string | null
          announcement_en?: string | null
          announcement_visible?: boolean
          build_box_enabled?: boolean
          distance_factor?: number
          facebook_url?: string | null
          fee_per_km?: number | null
          fee_round_to?: number
          ga4_id?: string | null
          id?: number
          instagram_url?: string | null
          instapay_handle?: string | null
          instapay_link?: string | null
          instapay_name?: string | null
          meta_pixel_id?: string | null
          min_shipping_fee?: number
          notify_emails?: string[]
          orders_paused?: boolean
          paused_message_ar?: string | null
          paused_message_en?: string | null
          seo_description?: string | null
          seo_title?: string | null
          site_url?: string
          store_address?: string | null
          store_lat?: number | null
          store_lng?: number | null
          tiktok_pixel_id?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_button?: boolean
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          note: string | null
          order_id: string | null
          product_id: string
          reason: Database["public"]["Enums"]["movement_reason"]
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          note?: string | null
          order_id?: string | null
          product_id: string
          reason: Database["public"]["Enums"]["movement_reason"]
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          note?: string | null
          order_id?: string | null
          product_id?: string
          reason?: Database["public"]["Enums"]["movement_reason"]
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_prices"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          is_visible: boolean
          name: string | null
          sort: number
          text_ar: string | null
          text_en: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_path?: string | null
          is_visible?: boolean
          name?: string | null
          sort?: number
          text_ar?: string | null
          text_en?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
          is_visible?: boolean
          name?: string | null
          sort?: number
          text_ar?: string | null
          text_en?: string | null
        }
        Relationships: []
      }
      variants: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          is_active: boolean
          label_ar: string | null
          label_en: string | null
          option_value_id: string | null
          price: number | null
          product_id: string
          sort: number
          stock_qty: number
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          label_ar?: string | null
          label_en?: string | null
          option_value_id?: string | null
          price?: number | null
          product_id: string
          sort?: number
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          label_ar?: string | null
          label_en?: string | null
          option_value_id?: string | null
          price?: number | null
          product_id?: string
          sort?: number
          stock_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variants_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      variant_prices: {
        Row: {
          cost: number | null
          cost_overridden: boolean | null
          is_active: boolean | null
          option_value_id: string | null
          price: number | null
          price_overridden: boolean | null
          product_id: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _admin_compute: { Args: { p: Json }; Returns: Json }
      _compute_order: { Args: { p: Json }; Returns: Json }
      _delivery: { Args: { p_lat: number; p_lng: number }; Returns: Json }
      _km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      _normalize_phone: { Args: { p: string }; Returns: string }
      _notify_new_message: { Args: { p_id: string }; Returns: undefined }
      _notify_new_order: { Args: { p_order: string }; Returns: undefined }
      _store_images: { Args: { p_product: string }; Returns: Json }
      _store_product_card: {
        Args: { p: Database["public"]["Tables"]["products"]["Row"] }
        Returns: Json
      }
      _store_variants: {
        Args: { p: Database["public"]["Tables"]["products"]["Row"] }
        Returns: Json
      }
      _variant_price: {
        Args: {
          p: Database["public"]["Tables"]["products"]["Row"]
          v: Database["public"]["Tables"]["variants"]["Row"]
        }
        Returns: number
      }
      admin_place_order: { Args: { p: Json }; Returns: Json }
      admin_quote: { Args: { p: Json }; Returns: Json }
      admin_set_order_status: {
        Args: {
          p_note?: string
          p_order: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_email: { Args: { p_email: string }; Returns: boolean }
      place_order: { Args: { p: Json }; Returns: Json }
      store_bundles: { Args: never; Returns: Json }
      store_catalog: { Args: never; Returns: Json }
      store_contact: { Args: { p: Json }; Returns: undefined }
      store_order: { Args: { p_id: string }; Returns: Json }
      store_product: { Args: { p_slug: string }; Returns: Json }
      store_quote: { Args: { p: Json }; Returns: Json }
      store_settings: { Args: never; Returns: Json }
      store_track_checkout: { Args: { p: Json }; Returns: undefined }
    }
    Enums: {
      ad_platform: "meta" | "tiktok" | "google" | "snapchat" | "other"
      discount_type: "percent" | "fixed" | "free_shipping"
      movement_reason:
        | "order"
        | "cancelled"
        | "refused"
        | "batch"
        | "adjustment"
        | "initial"
      order_status:
        | "new"
        | "confirmed"
        | "preparing"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "refused"
      payment_method: "cod" | "instapay"
      payment_status: "unpaid" | "paid"
      product_status: "draft" | "active" | "archived"
      stock_unit: "grams" | "pieces"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ad_platform: ["meta", "tiktok", "google", "snapchat", "other"],
      discount_type: ["percent", "fixed", "free_shipping"],
      movement_reason: [
        "order",
        "cancelled",
        "refused",
        "batch",
        "adjustment",
        "initial",
      ],
      order_status: [
        "new",
        "confirmed",
        "preparing",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refused",
      ],
      payment_method: ["cod", "instapay"],
      payment_status: ["unpaid", "paid"],
      product_status: ["draft", "active", "archived"],
      stock_unit: ["grams", "pieces"],
    },
  },
} as const
