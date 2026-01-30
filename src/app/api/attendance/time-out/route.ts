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

    // Get today's attendance record for the user
    const today = new Date().toISOString().split('T')[0];
    const { data: attendanceRecord, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .is('time_out', null)
      .single();

    if (fetchError || !attendanceRecord) {
      return NextResponse.json(
        { error: "No active time-in record found. Please time in first." },
        { status: 400 }
      );
    }

    // Calculate total hours
    const timeOut = new Date();
    const timeIn = new Date(attendanceRecord.time_in);
    const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60); // Convert to hours

    // Update attendance record with time-out and total hours
    const { data, error } = await supabase
      .from('attendance')
      .update({
        time_out: timeOut.toISOString(),
        total_hours: parseFloat(totalHours.toFixed(2))
      })
      .eq('id', attendanceRecord.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to record time-out" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Time-out recorded successfully",
      totalHours: parseFloat(totalHours.toFixed(2)),
      data
    });

  } catch (error) {
    console.error("Time-out error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
