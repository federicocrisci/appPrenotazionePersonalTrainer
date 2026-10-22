import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Temporal } from '@js-temporal/polyfill';
import { AlertController, IonButton, IonContent, IonLabel, IonSegment, IonSegmentButton, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import type { AvailabilityException, Booking, Slot } from '../../core/models';
import { dateInZone } from '../../shared/utils/date';
import { BookingCardComponent } from '../../shared/components/booking-card.component';

interface CalendarDay { day:string; label:string; bookings:Booking[]; slots:Slot[]; blocks:AvailabilityException[]; }
@Component({
  selector:'app-calendar', standalone:true,
  imports:[DatePipe,FormsModule,RouterLink,IonButton,IonContent,IonLabel,IonSegment,IonSegmentButton,IonSpinner,BookingCardComponent],
  template:`
    <ion-content><main class="page-container">
      <p class="eyebrow">Spazio alle tue sessioni</p><div class="heading"><h1>Calendario</h1><ion-button size="small" fill="outline" routerLink="/app/availability">Disponibilità</ion-button></div>
      <ion-segment [value]="view()" (ionChange)="changeView($event.detail.value)"><ion-segment-button value="day"><ion-label>Giorno</ion-label></ion-segment-button><ion-segment-button value="week"><ion-label>Settimana</ion-label></ion-segment-button></ion-segment>
      <div class="date-navigation"><ion-button fill="clear" aria-label="Periodo precedente" (click)="move(-1)" [disabled]="!initialized()">‹</ion-button><label><span class="sr-only">Giorno nel fuso del trainer</span><input type="date" class="native-input" [ngModel]="day" (ngModelChange)="chooseDay($event)" [disabled]="!initialized()"/></label><ion-button fill="clear" aria-label="Periodo successivo" (click)="move(1)" [disabled]="!initialized()">›</ion-button></div>
      <p class="subtle">Giorni organizzati nel fuso {{timezone()}}. Gli orari degli appuntamenti sono nel fuso del dispositivo ({{localTimezone}}).</p>
      <div class="legend"><span><i class="free"></i>Libero</span><span><i class="busy"></i>Prenotato</span><span><i class="blocked"></i>Non disponibile</span></div>
      @if(message()){<p class="success-state" role="status">{{message()}}</p>}
      @if(error()){<div class="error-state" role="alert">{{error()}}<ion-button fill="clear" (click)="load()">Riprova</ion-button></div>}
      @if(loading()){<div class="loading-state" role="status"><ion-spinner/>Caricamento agenda…</div>}
      @else{
        @for(entry of days();track entry.day){
          <section class="calendar-day" [attr.aria-label]="entry.label"><h2>{{entry.label}}</h2>
            @for(booking of entry.bookings;track booking.id){<app-booking-card [booking]="booking" [trainer]="true" [canCancel]="booking.status === 'confirmed'" [busy]="cancelling()" (cancelRequested)="askCancel($event)"/>}
            @for(block of entry.blocks;track block.id){<div class="blocked-period"><strong>Non disponibile · {{reasonLabel(block.reason)}}</strong><p>{{block.starts_at|date:'d MMM HH:mm'}} – {{block.ends_at|date:'d MMM HH:mm'}}</p></div>}
            @if(entry.slots.length){<h3>Orari liberi</h3><div class="free-slots">@for(slot of entry.slots;track slot.starts_at){<span>{{slot.starts_at|date:'HH:mm'}}–{{slot.ends_at|date:'HH:mm'}}</span>}</div>}
            @else{<p class="empty-slots">Nessuno slot libero.</p>}
            @if(!entry.bookings.length && !entry.blocks.length && !entry.slots.length){<p class="empty-state">Non ci sono appuntamenti o fasce prenotabili per questo giorno.</p>}
          </section>
        }
        <p class="subtle">Gli orari al di fuori delle fasce configurate non sono prenotabili. Le sessioni concluse sono visualizzate come completate.</p>
      }
    </main></ion-content>
  `,
  styles:[`.heading{display:flex;gap:10px;justify-content:space-between;align-items:center}.heading h1{margin-right:auto}.date-navigation{display:flex;align-items:center;justify-content:center;gap:6px;margin:18px 0}.date-navigation label{flex:1;max-width:260px}.date-navigation ion-button{font-size:1.8rem}.subtle{font-size:.8rem;line-height:1.5;color:var(--ion-color-medium-shade)}.legend{display:flex;flex-wrap:wrap;gap:16px;font-size:.8rem;margin:20px 0}.legend span{display:flex;gap:6px;align-items:center}.legend i{display:block;width:10px;height:10px;border-radius:50%}.free{background:var(--ion-color-success)}.busy{background:var(--ion-color-primary)}.blocked{background:var(--ion-color-medium)}.calendar-day{padding:20px 0;border-top:1px solid var(--ion-color-light-shade)}h2{font-size:1.1rem;text-transform:capitalize;margin:0 0 16px}h3{font-size:.85rem;font-weight:600;color:var(--ion-color-success-shade)}.free-slots{display:flex;flex-wrap:wrap;gap:8px}.free-slots span{padding:9px 12px;border:1px solid var(--ion-color-success);border-radius:10px;font-size:.85rem;background:color-mix(in srgb,var(--ion-color-success) 8%,transparent)}.blocked-period{padding:14px;border-left:4px solid var(--ion-color-medium);border-radius:8px;background:var(--ion-color-light);margin:12px 0;font-size:.85rem}.blocked-period p{margin:5px 0 0}.empty-slots{font-size:.85rem;color:var(--ion-color-medium-shade)}.success-state{padding:12px;color:var(--ion-color-success-shade)}`],
})
export class CalendarPage {
  private readonly service=inject(BookingService);
  private readonly auth=inject(AuthService);
  private readonly alerts=inject(AlertController);
  readonly localTimezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  readonly timezone=signal(this.localTimezone);
  readonly view=signal<'day'|'week'>('day');
  readonly initialized=signal(false);
  readonly loading=signal(true);
  readonly error=signal('');
  readonly message=signal('');
  readonly cancelling=signal(false);
  readonly days=signal<CalendarDay[]>([]);
  day=dateInZone(new Date(),this.localTimezone);
  private requestId=0;
  readonly trainerId=computed(()=>this.auth.profile()?.id ?? '');
  ionViewWillEnter():void{void this.load();}
  async load():Promise<void>{
    const request=++this.requestId;
    this.loading.set(true);this.error.set('');
    try{
      const [trainer,bookings,blocks]=await Promise.all([this.service.ownTrainerProfile(),this.service.bookings(),this.service.exceptions()]);
      if(request!==this.requestId)return;
      this.timezone.set(trainer.timezone);
      if(!this.initialized()){this.day=dateInZone(new Date(),trainer.timezone);this.initialized.set(true);}
      const selected=Temporal.PlainDate.from(this.day);
      const start=this.view()==='week'?selected.subtract({days:selected.dayOfWeek-1}):selected;
      const dates=Array.from({length:this.view()==='week'?7:1},(_,index)=>start.add({days:index}).toString());
      const result=await Promise.all(dates.map(async day=>{
        const from=Temporal.PlainDate.from(day).toZonedDateTime(this.timezone()).epochMilliseconds;
        const to=Temporal.PlainDate.from(day).add({days:1}).toZonedDateTime(this.timezone()).epochMilliseconds;
        const intersects=(value:{starts_at:string;ends_at:string}):boolean=>Date.parse(value.starts_at)<to && Date.parse(value.ends_at)>from;
        const slots=await this.service.slots(this.trainerId(),day);
        const label=new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',timeZone:this.timezone()}).format(new Date(from));
        return {day,label,slots,bookings:bookings.filter(intersects).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)),blocks:blocks.filter(intersects)};
      }));
      if(request===this.requestId)this.days.set(result);
    }catch(error){if(request===this.requestId)this.error.set(this.service.message(error));}
    finally{if(request===this.requestId)this.loading.set(false);}
  }
  reasonLabel(reason:string|null):string{return ({absence:'Assenza',vacation:'Ferie',blocked:'Blocco orario'} as Record<string,string>)[reason??'']??reason??'Blocco';}
  changeView(value:unknown):void{this.view.set(value==='week'?'week':'day');void this.load();}
  chooseDay(day:string):void{if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return;this.day=day;void this.load();}
  move(direction:number):void{this.day=Temporal.PlainDate.from(this.day).add({days:direction*(this.view()==='week'?7:1)}).toString();void this.load();}
  async askCancel(booking:Booking):Promise<void>{
    if(this.cancelling())return;
    const alert=await this.alerts.create({header:'Cancellare l’appuntamento?',message:'L’appuntamento rimarrà nello storico e il cliente vedrà la cancellazione.',buttons:[{text:'Mantieni',role:'cancel'},{text:'Cancella appuntamento',role:'confirm'}]});
    await alert.present();if((await alert.onDidDismiss()).role!=='confirm')return;
    this.cancelling.set(true);this.message.set('');this.error.set('');
    try{await this.service.cancel(booking.id);this.message.set('Appuntamento cancellato.');await this.load();}
    catch(error){this.error.set(this.service.message(error));}
    finally{this.cancelling.set(false);}
  }
}
