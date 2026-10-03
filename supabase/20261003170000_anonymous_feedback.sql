CREATE TABLE IF NOT EXISTS anonymous_feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread' NOT NULL
);

-- Enable RLS
ALTER TABLE anonymous_feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert feedback (but no user_id is saved)
CREATE POLICY "Allow authenticated users to insert feedback" ON anonymous_feedback
    FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

-- Allow admins/managers to view all feedback
CREATE POLICY "Allow admins to view feedback" ON anonymous_feedback
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );
    
-- Allow admins/managers to update feedback (e.g. mark as read/resolved)
CREATE POLICY "Allow admins to update feedback" ON anonymous_feedback
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );
