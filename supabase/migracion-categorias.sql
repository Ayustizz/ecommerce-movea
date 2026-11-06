-- =====================================
-- TIENDA - CATEGORÍAS EDITABLES
-- Ejecutar una sola vez en el SQL Editor de Supabase,
-- después de migracion-tienda.sql.
-- No borra productos ni ventas.
-- =====================================


-- CATEGORÍAS Y SUBCATEGORÍAS

create table public.categories (
    slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
    name text not null check (char_length(name) between 2 and 60),
    parent_slug text references public.categories (slug) on delete cascade,
    sort_order integer not null default 100,
    created_at timestamptz not null default now(),
    check (parent_slug is distinct from slug)
);

alter table public.categories enable row level security;

revoke all on public.categories from anon, authenticated;

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

create policy "todos ven categorias" on public.categories
    for select to anon, authenticated
    using (true);

create policy "admin crea categorias" on public.categories
    for insert to authenticated
    with check (public.is_admin());

create policy "admin edita categorias" on public.categories
    for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "admin borra categorias" on public.categories
    for delete to authenticated
    using (public.is_admin());

insert into public.categories (slug, name, parent_slug, sort_order) values
    ('shorts', 'Shorts', null, 1),
    ('shorts-push-up', 'Push up', 'shorts', 1),
    ('shorts-sin-frunce', 'Sin frunce', 'shorts', 2),
    ('calzas', 'Calzas', null, 2),
    ('calzas-rectas', 'Rectas', 'calzas', 1),
    ('calzas-oxford', 'Oxford', 'calzas', 2),
    ('tops-deportivos', 'Tops deportivos', null, 3),
    ('corpinos-deportivos', 'Corpiños deportivos', null, 4);


-- PRODUCTOS
-- Buzos y joggers quedan "sin categoría" hasta elegirles una en el panel.
-- Una categoría con productos no se puede borrar.

alter table public.products
    drop constraint products_category_check,
    alter column category drop not null;

update public.products set category = 'tops-deportivos' where category = 'tops';
update public.products set category = null where category in ('buzos', 'joggers');

alter table public.products
    add constraint products_category_fkey
        foreign key (category) references public.categories (slug)
        on update cascade on delete restrict;
