import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'rc_abogados')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin or RC Abogados role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (req.method === 'GET' && action === 'list') {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .order('full_name');

      const usersWithDetails = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          const { data: clientUsers } = await supabase
            .from('client_users')
            .select('client_id')
            .eq('user_id', profile.id);

          return {
            id: profile.id,
            email: authUser?.user?.email || '',
            full_name: profile.full_name,
            role: profile.role,
            client_users: clientUsers || [],
          };
        })
      );

      return new Response(
        JSON.stringify({ users: usersWithDetails }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && action === 'create') {
      const { email, password, full_name, role, client_ids } = await req.json();

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: authError?.message || 'Failed to create user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({ id: authData.user.id, full_name, role });

      if (profileError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (client_ids && client_ids.length > 0) {
        const clientUserInserts = client_ids.map((clientId: string) => ({
          client_id: clientId,
          user_id: authData.user.id,
          granted_by: user.id,
        }));

        await supabase.from('client_users').insert(clientUserInserts);
      }

      return new Response(
        JSON.stringify({ success: true, user_id: authData.user.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'PUT' && action === 'update') {
      const { user_id, full_name, role, client_ids, new_password } = await req.json();

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ full_name, role })
        .eq('id', user_id);

      if (profileError) {
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from('client_users').delete().eq('user_id', user_id);

      if (client_ids && client_ids.length > 0) {
        const clientUserInserts = client_ids.map((clientId: string) => ({
          client_id: clientId,
          user_id,
          granted_by: user.id,
        }));

        await supabase.from('client_users').insert(clientUserInserts);
      }

      if (new_password) {
        await supabase.auth.admin.updateUserById(user_id, { password: new_password });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE' && action === 'delete') {
      const { user_id } = await req.json();

      const { error } = await supabase.auth.admin.deleteUser(user_id);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});