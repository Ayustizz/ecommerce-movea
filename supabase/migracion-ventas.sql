-- =====================================
-- TIENDA - PAGO Y ENTREGA POR SEPARADO, ELIMINAR PEDIDOS
-- Ejecutar una sola vez en el SQL Editor de Supabase,
-- después de migracion-categorias.sql.
-- No borra pedidos.
-- =====================================


-- PAGO Y ENTREGA
-- status pasa a ser solo el pago: pendiente, pagado o cancelado.
-- La entrega se marca aparte, así un pedido puede estar pagado y sin entregar
-- o entregado y todavía sin cobrar.

alter table public.orders
    add column delivered boolean not null default false;

update public.orders
set status = 'pagado', delivered = true
where status = 'entregado';

alter table public.orders
    drop constraint orders_status_check,
    add constraint orders_status_check
        check (status in ('pendiente', 'pagado', 'cancelado'));


-- ELIMINAR PEDIDOS

grant delete on public.orders to authenticated;

create policy "admin borra ventas" on public.orders
    for delete to authenticated
    using (public.is_admin());

-- Un pedido que no estaba cancelado todavía tiene el stock tomado: se devuelve.

create function public.return_deleted_order_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item public.order_items%rowtype;
begin
    if old.status = 'cancelado' then
        return old;
    end if;

    for v_item in
        select * from public.order_items
        where order_id = old.id and stock_reserved
    loop
        update public.product_stock
        set quantity = quantity + v_item.quantity
        where product_id = v_item.product_id
            and size = v_item.size
            and color = v_item.color;
    end loop;

    return old;
end;
$$;

revoke all on function public.return_deleted_order_stock() from public, anon, authenticated;

create trigger orders_return_stock_on_delete
    before delete on public.orders
    for each row
    execute function public.return_deleted_order_stock();
