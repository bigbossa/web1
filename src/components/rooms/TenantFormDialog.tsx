import { useForm } from "react-hook-form";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/providers/LanguageProvider";

// --- ประเภทข้อมูลผู้เช่า
type TenantInsert = Database["public"]["Tables"]["tenants"]["Insert"];

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room_id: string;
  room_number: string;
  isLoading?: boolean;
}

export default function TenantFormDialog({
  open,
  onOpenChange,
  room_id,
  room_number,
  isLoading = false,
}: TenantFormDialogProps) {
  const form = useForm<TenantInsert>({
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      address: "",
      emergency_contact: "",
      room_number: room_number,
    },
  });

  const { t } = useLanguage();

  useEffect(() => {
    form.setValue("room_number", room_number); // อัปเดต room_number จาก props
  }, [room_number]);

  const handleSubmit = async (data: TenantInsert) => {
    try {
      // 1. ดึงความจุของห้อง
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("id, capacity")
        .eq("id", room_id)
        .maybeSingle();

      if (roomError || !roomData) {
        console.error("❌ ไม่สามารถดึงข้อมูลห้องได้", roomError);
        alert("ไม่สามารถตรวจสอบจำนวนผู้พักในห้องได้");
        return;
      }

      const capacity = roomData.capacity || 0;

      // 2. เช็กจำนวนผู้พักปัจจุบันในห้องนี้
      const { count: occupantCount, error: occCountError } = await supabase
        .from("occupancy")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room_id)
        .eq("is_current", true);

      if (occCountError) {
        console.error("❌ ไม่สามารถเช็กจำนวนผู้พักได้", occCountError);
        alert("เกิดข้อผิดพลาดในการเช็กจำนวนผู้พัก");
        return;
      }

      if (occupantCount >= capacity) {
        alert("ห้องนี้เต็มแล้ว ไม่สามารถเพิ่มผู้เช่าได้");
        return;
      }

      // 3. เตรียมข้อมูลผู้เช่า
      const tenantPayload = {
        ...data,
        residents: "ลูกเช่า",
        room_id,
        room_number,
      };

      // 4. เพิ่มผู้เช่า
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .insert(tenantPayload)
        .select()
        .single();

      if (tenantError || !tenantData) {
        console.error("❌ เพิ่ม tenant ไม่สำเร็จ", tenantError);
        return;
      }

      // 5. เพิ่มข้อมูลลง occupancy
      const { error: occError } = await supabase.from("occupancy").insert({
        tenant_id: tenantData.id,
        room_id: tenantData.room_id,
        check_in_date: new Date().toISOString().split("T")[0],
        is_current: true,
      });

      if (occError) {
        console.error("❌ เพิ่ม occupancy ไม่สำเร็จ", occError);
        return;
      }

      console.log("✅ เพิ่มผู้เช่าและ occupancy เรียบร้อย");
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาด", error);
      alert("เกิดข้อผิดพลาดไม่สามารถเพิ่มผู้เช่าได้");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("tenants.add")}</DialogTitle>
          <DialogDescription>{t("tenants.formDesc")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                rules={{ required: t("tenants.firstNameRequired") }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.firstName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("profile.firstName")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                rules={{ required: t("tenants.lastNameRequired") }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.lastName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("profile.lastName")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.email")}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder={t("profile.email")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.phone")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("profile.phone")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.address")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("profile.address")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emergency_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("tenants.emergencyContact")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("tenants.emergencyContact")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="text-sm text-muted-foreground">
              {t("tenants.selectedRoom")}: <strong>{room_number}</strong>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? t("saving") || "Saving..." : t("tenants.add")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
