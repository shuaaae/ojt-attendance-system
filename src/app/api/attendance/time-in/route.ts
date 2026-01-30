import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user already has a time-in record for today without time-out
    const today = new Date().toISOString().split('T')[0];
    const { data: existingRecord, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .is('time_out', null)
      .single();

    if (existingRecord) {
      return NextResponse.json(
        { error: "You already have an active time-in record. Please time out first." },
        { status: 400 }
      );
    }

    // Insert new attendance record with time-in
    const { data, error } = await supabase
      .from('attendance')
      .insert([
        {
          user_id: userId,
          date: today,
          time_in: new Date().toISOString(),
          status: 'present'
        }
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to record time-in" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Time-in recorded successfully",
      data
    });

  } catch (error) {
    console.error("Time-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
